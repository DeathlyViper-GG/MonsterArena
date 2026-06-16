// network_http.js (HTTP authoritative)
(() => {
  const BASE = window.location.origin;
  function getSavedAppearance() {
    try {
      const raw = localStorage.getItem('arenaSettings');
      const s = raw ? JSON.parse(raw) : {};
      return {
        design: Number.isInteger(s.design) ? s.design : 0,
        color:  Number.isInteger(s.color)  ? s.color  : 0
      };
    } catch {
      return { design: 0, color: 0 };
    }
  }

  const Net = {
    state: {
      lobbyId: null,
      peerId: null,
      myId: null,       // compat with older code
      snapshot: null,
      meta: null
    },

    

    // ✅ Keep old API working
    setSignalUrl(_) { /* HTTP server uses same origin; ignore */ },
    setNickname(nick) { try { localStorage.setItem('arenaNick', nick); } catch {} },

    async connect({ mode = "pve", nickname = null } = {}) {
      return this.join(mode, nickname);
    },

    async join(mode = "pve", nickname = null) {
    const nick = nickname || localStorage.getItem('arenaNick') || "Player";

    const r = await fetch(`${BASE}/lobby/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, nickname: nick })
    });

    const j = await r.json();
    this.state.lobbyId = j.lobbyId;
    this.state.peerId = j.peerId;
    this.state.myId = j.peerId;

    // ✅ Sync appearance immediately
    

    this.state.meta = {
      lobbyId: j.lobbyId,
      mode: j.mode,
      joinDeadline: j.startTime,
      levelId: j.levelId ?? null,
      mapSeed: j.mapSeed ?? null,
      worldKey: j.worldKey ?? null
    };

    this.poll();
    window.dispatchEvent(new CustomEvent("net:meta", { detail: this.state.meta }));
    return j;
  },

   async setLevel(levelId) {
      if (!this.state.lobbyId) throw new Error("Not joined");
      const r = await fetch(`${BASE}/lobby/setLevel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lobbyId: this.state.lobbyId,
          peerId: this.state.peerId,
          levelId
        })
      });

      const j = await r.json();

      // ✅ If server migrated us to a new lobby, switch
      if (j && j.ok && j.lobbyId && j.lobbyId !== this.state.lobbyId) {
        this.state.lobbyId = j.lobbyId;
      }
      // ✅ Re‑sync appearance after lobby migration
      // ✅ Re‑sync appearance after lobby migration
      this.state.meta = { ...(this.state.meta || {}), ...j };
      window.dispatchEvent(new CustomEvent("net:meta", { detail: this.state.meta }));
      return j;
    },

    async openChest(chestId){
      if (!this.state.lobbyId) return { ok:false };
      const r = await fetch(`${BASE}/chest/open`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lobbyId: this.state.lobbyId,
          peerId: this.state.peerId,
          chestId
        })
      });
      return r.json();
    },

    async setGuns(guns) {
      if (!this.state.lobbyId || !this.state.peerId) return;

      await fetch(`${BASE}/player/guns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId: this.state.lobbyId,
          peerId: this.state.peerId,
          guns
        })
      });
    },

    async setDesign(design) {
      if (!this.state.lobbyId || !this.state.peerId) return;

      await fetch(`${BASE}/player/design`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId: this.state.lobbyId,
          peerId: this.state.peerId,
          design
        })
      });
    },

    async setColor(color) {
      if (!this.state.lobbyId || !this.state.peerId) return;

      await fetch(`${BASE}/player/color`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lobbyId: this.state.lobbyId,
          peerId: this.state.peerId,
          color
        })
      });
    },


    async leave() {
      if (!this.state.lobbyId || !this.state.peerId) return;

      const lobbyId = this.state.lobbyId;
      const peerId = this.state.peerId;

      try {
        await fetch(`${BASE}/lobby/leave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lobbyId, peerId })
        });
      } catch (e) {
        console.warn('[NET] leave failed', e);
      }

      // ✅ Stop polling by invalidating state
      this.state.lobbyId = null;
      this.state.peerId = null;
      this.state.snapshot = null;
    },

    async poll() {
      while (this.state.lobbyId) {
        try {
          const since = this.state.snapshot?.t ?? 0;
          const worldKey = encodeURIComponent(this.state.meta?.worldKey ?? '');
          const r = await fetch(
            `${BASE}/poll?lobbyId=${this.state.lobbyId}&peerId=${this.state.peerId}&since=${since}&worldKey=${worldKey}`,
            { cache: 'no-store' }
          );

          if (r.status === 204) {
            await new Promise(res => setTimeout(res, 60)); 
            continue; 
          }
          const snap = await r.json();
          this.state.snapshot = snap;
          window.dispatchEvent(new CustomEvent('net:snapshot', { detail: snap }));

          if (snap?.meta) {
            const oldKey = JSON.stringify(this.state.meta ?? {});
            const newKey = JSON.stringify(snap.meta ?? {});
            if (oldKey !== newKey) {
              this.state.meta = snap.meta;
              window.dispatchEvent(new CustomEvent('net:meta', { detail: this.state.meta }));
            }
          }
        } catch {
          await new Promise(res => setTimeout(res, 250));
        }
      }

      console.log('[NET] poll stopped');
    },

    
    async setWorld(walls, hazards, worldKey) {
      if (!this.state.lobbyId) throw new Error("Not joined");
      await fetch(`${BASE}/lobby/setWorld`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lobbyId: this.state.lobbyId,
          walls,
          hazards,
          worldKey
        })
      });
    },


    sendInput(ix, iy, ang, x, y, weapon) {
      // ✅ throttle input sends (reduces lag massively)
      const now = performance.now();
      const MIN_MS = 50; // ~30 sends/sec (try 50 for ~20/sec if still heavy)
      if (this._lastInputAt && (now - this._lastInputAt) < MIN_MS) return;
      this._lastInputAt = now;

      // Optional: skip if not joined yet
      if (!this.state.lobbyId || !this.state.peerId) return;

      fetch(`${BASE}/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lobbyId: this.state.lobbyId,
          peerId: this.state.peerId,
          ix, iy, ang,
          x, y,
          weapon
        })
      }).catch(() => {});
    },

    sendShoot(x, y, ang, speed, dmg) {
      fetch(`${BASE}/shoot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lobbyId: this.state.lobbyId, peerId: this.state.peerId, x, y, ang, speed, dmg })
      });
    },

    sendHit(target, x, y, dmg, kind = "") {
        fetch(`${BASE}/hit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lobbyId: this.state.lobbyId, peerId: this.state.peerId, target, x, y, dmg, kind })
        });
      }
    };

  window.Net = Net;
})();
