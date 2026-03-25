// network_http.js (HTTP authoritative)
(() => {
  const BASE = window.SIGNAL_URL || "http://localhost:8080";

  const Net = {
    state: {
      lobbyId: null,
      peerId: null,
      myId: null,       // compat with older code
      snapshot: null,
      meta: null
    },

    // ✅ Keep old API working
    async connect({ mode = "pve" } = {}) {
        return this.join(mode);
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

    this.state.meta = {
      lobbyId: j.lobbyId,
      mode: j.mode,
      joinDeadline: j.startTime,
      levelId: j.levelId ?? null,
      mapSeed: j.mapSeed ?? null
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

    async poll() {
      while (true) {
        try {
          const r = await fetch(`${BASE}/poll?lobbyId=${this.state.lobbyId}`);
          const snap = await r.json();
          this.state.snapshot = snap;
          window.dispatchEvent(new CustomEvent("net:snapshot", { detail: snap }));

          // If server includes meta, keep UI updated
          if (snap && snap.meta) {
            const oldKey = JSON.stringify(this.state.meta || {});
            const newKey = JSON.stringify(snap.meta || {});
            if (oldKey !== newKey) {
              this.state.meta = snap.meta;
              window.dispatchEvent(new CustomEvent("net:meta", { detail: this.state.meta }));
            }
          }
        } catch {}
        await new Promise(res => setTimeout(res, 25));
      }
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


    sendInput(ix, iy, ang, x, y) {
      fetch(`${BASE}/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lobbyId: this.state.lobbyId,
          peerId: this.state.peerId,
          ix, iy, ang,
          x, y
        })
      });
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