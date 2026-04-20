// ============================================================
//  DIAMOND ENCLAVE — Owners Tab Logic
// ============================================================

function renderOwnersTab() {
  const locked  = document.getElementById("ownersLocked");
  const content = document.getElementById("ownersContent");
  if (!state.isAdmin) {
    locked.classList.remove("hidden"); content.classList.add("hidden"); return;
  }
  locked.classList.add("hidden"); content.classList.remove("hidden");
  _renderOwnersTable();
}

function _renderOwnersTable() {
  const tbody = document.getElementById("ownersTableBody");
  tbody.innerHTML = "";

  CONFIG.FLATS.forEach(flat => {
    const history    = Sheets.getFlatHistory(flat.id);
    const hasCurrent = history.some(o => !o.moveOut || o.moveOut === "");

    if (history.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="flat-badge">${flat.label}</span>
          ${flat.parking ? ' <span class="parking-tag">Parking</span>' : ""}
        </td>
        <td colspan="6" style="color:var(--text3);font-style:italic">
          ${flat.parking ? "Ownership & maintenance to be decided" : "No owner assigned yet"}
        </td>
        <td><button class="btn-pay" onclick="openAddOwnerModal('${flat.id}')">+ Add Owner</button></td>
      `;
      tbody.appendChild(tr);
      return;
    }

    history.forEach((owner, idx) => {
      const isCurrent = !owner.moveOut || owner.moveOut === "";
      const tr = document.createElement("tr");
      tr.classList.toggle("owner-past-row", !isCurrent);
      tr.innerHTML = `
        <td>
          ${idx===0 ? `<span class="flat-badge">${flat.label}</span>${flat.parking?' <span class="parking-tag">Parking</span>':""}` : ""}
        </td>
        <td>
          <div class="owner-name-cell">
            <span class="owner-name">${owner.name}</span>
            <span class="${isCurrent?"current-owner-tag":"past-owner-tag"}">${isCurrent?"Current":"Past"}</span>
          </div>
        </td>
        <td><span class="detail-text">${owner.email||"—"}</span></td>
        <td><span class="detail-text">${owner.phone||"—"}</span></td>
        <td><span class="detail-text">${fmtMonthKey(owner.moveIn)}</span></td>
        <td><span class="detail-text">${owner.moveOut ? fmtMonthKey(owner.moveOut) : "—"}</span></td>
        <td><span class="${isCurrent?"current-owner-tag":"past-owner-tag"}">${isCurrent?"Active":"Past"}</span></td>
        <td>
          <div class="action-group">
            <button class="btn-pay" onclick="openEditOwnerModal('${owner.id}')">✏ Edit</button>
            ${isCurrent ? `<button class="btn-bill" onclick="openTransferModal('${flat.id}','${owner.id}')">↔ Transfer</button>` : ""}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    if (!hasCurrent) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td></td>
        <td colspan="6" style="color:var(--warn);font-style:italic;font-size:13px">⚠ Awaiting new owner assignment</td>
        <td><button class="btn-pay" onclick="openAddOwnerModal('${flat.id}')">+ Add Owner</button></td>
      `;
      tbody.appendChild(tr);
    }
  });
}

// ── Add Owner Modal ───────────────────────────────────────────
function openAddOwnerModal(flatId) {
  state.ownerModalMode = "add";
  state.ownerFlatId    = flatId;
  const flat = getFlatCfg(flatId);
  document.getElementById("ownerModalTitle").textContent = `Add Owner — ${flat.label}`;
  document.getElementById("ownerName").value    = "";
  document.getElementById("ownerEmail").value   = "";
  document.getElementById("ownerPhone").value   = "";
  document.getElementById("ownerMoveIn").value  = "";
  document.getElementById("ownerMoveInGroup").classList.remove("hidden");
  document.getElementById("ownerMoveOutGroup").classList.add("hidden");
  document.getElementById("ownerModalError").classList.add("hidden");
  document.getElementById("ownerModal").classList.remove("hidden");
}

// ── Edit Owner Modal ──────────────────────────────────────────
function openEditOwnerModal(recordId) {
  const owner = Sheets.getOwners().find(o => o.id === recordId);
  if (!owner) return;
  state.ownerModalMode = "edit";
  state.ownerRecordId  = recordId;
  const flat = getFlatCfg(owner.flatId);
  document.getElementById("ownerModalTitle").textContent = `Edit Owner — ${flat.label}`;
  document.getElementById("ownerName").value    = owner.name  || "";
  document.getElementById("ownerEmail").value   = owner.email || "";
  document.getElementById("ownerPhone").value   = owner.phone || "";
  document.getElementById("ownerMoveIn").value  = owner.moveIn  || "";
  document.getElementById("ownerMoveOut").value = owner.moveOut || "";
  document.getElementById("ownerMoveInGroup").classList.remove("hidden");
  document.getElementById("ownerMoveOutGroup").classList.remove("hidden");
  document.getElementById("ownerModalError").classList.add("hidden");
  document.getElementById("ownerModal").classList.remove("hidden");
}

function closeOwnerModal() {
  document.getElementById("ownerModal").classList.add("hidden");
  state.ownerModalMode = null; state.ownerFlatId = null; state.ownerRecordId = null;
}

async function confirmOwnerModal() {
  const name    = document.getElementById("ownerName").value.trim();
  const email   = document.getElementById("ownerEmail").value.trim();
  const phone   = document.getElementById("ownerPhone").value.trim();
  const moveIn  = document.getElementById("ownerMoveIn").value;
  const moveOut = document.getElementById("ownerMoveOut").value;

  if (!name || !moveIn) {
    document.getElementById("ownerModalError").classList.remove("hidden");
    return;
  }
  document.getElementById("ownerModalError").classList.add("hidden");

  if (state.ownerModalMode === "add") {
    await Sheets.addOwner({ flatId: state.ownerFlatId, name, email, phone, moveIn, moveOut: "", notes: "" });
    showToast(`✓ Owner added`);
  } else {
    await Sheets.updateOwner(state.ownerRecordId, { name, email, phone, moveIn, moveOut });
    showToast(`✓ Owner updated`);
  }
  closeOwnerModal();
  _renderOwnersTable();
  renderTable(); // refresh payments table too (owner names may have changed)
}

// ── Transfer Ownership Modal ──────────────────────────────────
function openTransferModal(flatId, currentOwnerId) {
  state.transferFlatId    = flatId;
  state.transferCurrentId = currentOwnerId;
  const flat  = getFlatCfg(flatId);
  const owner = Sheets.getOwners().find(o => o.id === currentOwnerId);
  document.getElementById("transferModalTitle").textContent = `Transfer — ${flat.label}`;
  document.getElementById("transferModalSub").textContent   = `Current owner: ${owner ? owner.name : "—"}`;
  document.getElementById("transferMoveOut").value  = "";
  document.getElementById("transferName").value     = "";
  document.getElementById("transferEmail").value    = "";
  document.getElementById("transferPhone").value    = "";
  document.getElementById("transferMoveIn").value   = "";
  document.getElementById("transferError").classList.add("hidden");
  document.getElementById("transferModal").classList.remove("hidden");
}
function closeTransferModal() {
  document.getElementById("transferModal").classList.add("hidden");
  state.transferFlatId = null; state.transferCurrentId = null;
}
async function confirmTransfer() {
  const moveOut = document.getElementById("transferMoveOut").value;
  const name    = document.getElementById("transferName").value.trim();
  const email   = document.getElementById("transferEmail").value.trim();
  const phone   = document.getElementById("transferPhone").value.trim();
  const moveIn  = document.getElementById("transferMoveIn").value;

  if (!moveOut || !name || !moveIn) {
    document.getElementById("transferError").classList.remove("hidden");
    return;
  }
  document.getElementById("transferError").classList.add("hidden");
  showToast("Processing transfer…");

  await Sheets.transferOwnership(
    state.transferFlatId,
    moveOut,
    { name, email, phone, moveIn, notes: "" }
  );
  closeTransferModal();
  _renderOwnersTable();
  renderTable();
  showToast(`✓ Ownership transferred to ${name}`);
}
