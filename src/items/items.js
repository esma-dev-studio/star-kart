// アイテムシステム一式。Game.items として公開する。
// アイテムボックスの生成/取得/ルーレット、発射体・トラップ・投擲物のエンティティ管理、
// 各アイテムの効果適用、AIの使用判断までをこのモジュールが一元的に担当する。
// パラメータは全て Game.config.items から読む(マジックナンバー禁止)。

const ITEM_TUNING = {
  boxSize: 1.15,             // アイテムボックス本体の半径目安
  boxFloatY: 1.1,            // 路面からの浮遊高さ
  boxSpinSpeed: 1.1,         // 箱の自転速度(rad/s)
  boxBobSpeed: 2.2,          // 上下ぷかぷか揺れの速度
  boxBobAmp: 0.16,           // 上下ぷかぷか揺れの振幅
  boxGroundDrop: 2.5,        // 取得判定の高低差許容
  respawnFadeInSec: 0.5,     // 復活時の実体化フェード時間

  projGroundHeight: 0.55,    // 発射体(スコーン等)の路面からの高さ
  ownerSafeSec: 0.4,         // 発射直後、オーナーに衝突しない時間
  hitRadius: 1.6,            // 発射体とカートの衝突判定半径
  trapHitRadius: 1.7,        // トラップ(キャラメル)の踏み判定半径
  wallLateralMargin: 1.5,    // これを超えて壁の外に出たらsconeは消滅(halfWidth+offroad分の余裕)

  lemonArcGravity: 14,       // レモン爆弾の放物線用重力
  lemonBlastFudge: 0.6,      // 爆風半径にキャラ半径分の余裕を足す係数

  marshTurnEase: 6,          // マシュマロの旋回応答の滑らかさ

  shieldOrbitRadius: 1.05,
  shieldOrbitHeight: 0.85,
  shieldOrbitSpeed: 2.6,
  shieldCookieSize: 0.34,

  starAuraRadius: 1.9,
  starAuraPulseSpeed: 6,

  aiCdMin: 2, aiCdMax: 4,     // AI使用クールダウンのランダム範囲
  aiForceUseSec: 8,           // 取得からこの秒数で条件問わず使う
  aiFrontRange: 40,           // scone/marshmallow: 前方索敵距離
  aiRearRange: 15,            // caramel/lemon: 後方索敵距離
  aiLowRankThresh: 6,         // honey判定: この順位以下なら即使用対象
  aiBackRankThresh: 4,        // soda/rainbow/parfait: この順位以下で使用対象

  rouletteCycleSec: 0.09,     // ルーレット演出の切替間隔(HUD側で見た目を作る想定、内部状態のみ管理)
};

const ITEM_DEFS = {
  honey: { name: 'はちみつブースト', color: 0xffb703, tier: 'common' },
  scone: { name: 'いちごスコーン弾', color: 0xff5d8f, tier: 'common' },
  caramel: { name: 'キャラメルトラップ', color: 0xb9722a, tier: 'common' },
  marshmallow: { name: '追尾マシュマロ', color: 0xfff2f7, tier: 'uncommon' },
  shield: { name: 'クッキーシールド', color: 0xd9a15c, tier: 'uncommon' },
  lemon: { name: 'サワーレモン爆弾', color: 0xe6f24a, tier: 'uncommon' },
  star: { name: 'スターゼリー', color: 0xffe14d, tier: 'rare' },
  soda: { name: 'ソーダの嵐', color: 0x6fd8ff, tier: 'rare' },
  rainbow: { name: 'レインボースプリンクル', color: 0xff8fd8, tier: 'rare' },
  parfait: { name: 'ミラクルパフェ', color: 0xffc2e0, tier: 'rare' },
};

(function () {
  // ---- モジュールレベル共有ジオメトリ/マテリアル(使い回して生成コストを抑える) ----
  let SHARED = null;
  function ensureShared() {
    if (SHARED) return SHARED;
    SHARED = {
      boxGeo: new THREE.BoxGeometry(1.5, 1.5, 1.5),
      boxMat: new THREE.MeshLambertMaterial({ color: 0xffd23e }),
      boxStarTex: null,
      sconeGeo: new THREE.SphereGeometry(0.55, 10, 8),
      sconeMat: new THREE.MeshLambertMaterial({ color: ITEM_DEFS.scone.color }),
      caramelGeo: new THREE.CylinderGeometry(0.85, 0.95, 0.28, 10),
      caramelMat: new THREE.MeshLambertMaterial({ color: ITEM_DEFS.caramel.color }),
      marshGeo: new THREE.SphereGeometry(0.55, 10, 8),
      marshMat: new THREE.MeshLambertMaterial({ color: ITEM_DEFS.marshmallow.color }),
      lemonGeo: new THREE.SphereGeometry(0.5, 10, 8),
      lemonMat: new THREE.MeshLambertMaterial({ color: ITEM_DEFS.lemon.color }),
      blastGeo: new THREE.SphereGeometry(1, 12, 10),
      blastMat: new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, opacity: 0.55 }),
      cookieGeo: new THREE.TorusGeometry(ITEM_TUNING.shieldCookieSize, 0.1, 6, 12),
      cookieMat: new THREE.MeshLambertMaterial({ color: 0xc98a4b }),
      auraGeo: new THREE.SphereGeometry(ITEM_TUNING.starAuraRadius, 10, 8),
      auraMat: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 }),
    };
    // 箱に貼る星型キャンディのCanvasTexture
    const cv = document.createElement('canvas');
    cv.width = 128; cv.height = 128;
    const x = cv.getContext('2d');
    x.fillStyle = '#ffd23e'; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = '#c98a1e'; x.lineWidth = 5;
    x.strokeRect(3, 3, 122, 122);
    x.fillStyle = '#fff6d6';
    const cx = 64, cy = 64, spikes = 5, outerR = 34, innerR = 15;
    x.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const a = (Math.PI / spikes) * i - Math.PI / 2;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.closePath(); x.fill();
    x.strokeStyle = '#c98a1e'; x.lineWidth = 3; x.stroke();
    SHARED.boxStarTex = new THREE.CanvasTexture(cv);
    SHARED.boxMat = new THREE.MeshLambertMaterial({ map: SHARED.boxStarTex });
    return SHARED;
  }

  function weightedPick(weights) {
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = Math.random() * total;
    for (const k in weights) {
      r -= weights[k];
      if (r <= 0) return k;
    }
    return Object.keys(weights)[0];
  }

  function lotteryPick(rank) {
    const table = Game.config.items.lottery;
    for (const row of table) {
      if (rank <= row.maxRank) return weightedPick(row.weights);
    }
    return weightedPick(table[table.length - 1].weights);
  }

  Game.items = {
    defs: ITEM_DEFS,

    init(scene, course, race) {
      this._scene = scene;
      this._course = course;
      this._race = race;
      this._shared = ensureShared();

      this._boxes = []; // { spot, pos, group, taken, respawnT }
      this._entities = []; // 発射体/トラップ/投擲物
      this._time = 0;
      this._aiController = new WeakMap(); // kart -> AIController(rainbow用の自動走行流用)

      const spots = (course.def && course.def.itemSpots) || [];
      const s = course.spline;
      for (const spot of spots) {
        const idx = Math.floor(((spot.t % 1 + 1) % 1) * s.count) % s.count;
        const p = s.pts[idx], nrm = s.nrm[idx], w = s.w[idx];
        const pos = new THREE.Vector3(
          p.x + nrm.x * (spot.l * w),
          p.y + ITEM_TUNING.boxFloatY,
          p.z + nrm.z * (spot.l * w)
        );
        const group = this._buildBoxMesh();
        group.position.copy(pos);
        scene.add(group);
        this._boxes.push({ spot, idx, pos, group, taken: false, respawnT: 0 });
      }
    },

    _buildBoxMesh() {
      const sh = this._shared;
      const g = new THREE.Group();
      const box = new THREE.Mesh(sh.boxGeo, sh.boxMat);
      g.add(box);
      g.userData.box = box;
      return g;
    },

    // タイムアタック等アイテム無しレース用: 前レースの残留状態を撤去して無効化する
    // (initを呼ばないだけだと、前のレースの見えないボックスを拾えてしまう)
    disable() {
      if (this._scene) {
        if (this._boxes) for (const b of this._boxes) this._scene.remove(b.group);
        if (this._entities) for (const e of this._entities) { if (e.mesh) this._scene.remove(e.mesh); }
      }
      this._boxes = [];
      this._entities = [];
    },

    // ---- フレーム更新 ----
    update(dt, race) {
      if (!this._boxes) return; // 未初期化(initもdisableも未呼び出し)なら何もしない
      this._time += dt;
      if (!race || race.phase === 'finished') {
        // レース終了後もビジュアル演出程度は流すが新規判定はしない
        this._updateBoxVisuals(dt);
        return;
      }
      if (race.phase !== 'racing') { this._updateBoxVisuals(dt); return; }

      const karts = race.entries.map((e) => e.kart);

      this._updateBoxVisuals(dt);
      this._handlePickups(karts);
      this._updateRoulettes(dt, karts);
      this._updateEntities(dt, karts, race);
    },

    _updateBoxVisuals(dt) {
      for (const b of this._boxes) {
        const g = b.group;
        g.rotation.y += ITEM_TUNING.boxSpinSpeed * dt;
        const bob = Math.sin(this._time * ITEM_TUNING.boxBobSpeed + b.idx) * ITEM_TUNING.boxBobAmp;
        g.position.y = b.pos.y + bob;
        if (b.taken) {
          b.respawnT -= dt;
          const boxCfg = Game.config.items.boxRespawnSec;
          const fadeStart = ITEM_TUNING.respawnFadeInSec;
          if (b.respawnT <= 0) {
            b.taken = false;
            g.userData.box.visible = true;
            g.userData.box.material.opacity = 1;
          } else if (b.respawnT <= fadeStart) {
            g.userData.box.visible = true;
            const mat = g.userData.box.material;
            if (!mat.transparent) { mat.transparent = true; }
            mat.opacity = 1 - (b.respawnT / fadeStart);
          } else {
            g.userData.box.visible = false;
          }
        }
      }
    },

    _handlePickups(karts) {
      const cfg = Game.config.items;
      for (const b of this._boxes) {
        if (b.taken) continue;
        for (const kart of karts) {
          if (kart.finished) continue;
          if (kart.items.length > 0) continue;
          if (kart._rouletteT > 0) continue;
          const dx = kart.pos.x - b.pos.x, dz = kart.pos.z - b.pos.z;
          const dy = Math.abs(kart.pos.y - b.pos.y);
          if (dy > ITEM_TUNING.boxGroundDrop) continue;
          const dist = Math.hypot(dx, dz);
          if (dist <= cfg.pickupRadius) {
            b.taken = true;
            b.respawnT = cfg.boxRespawnSec;
            kart._rouletteT = cfg.rouletteSec;
            if (kart.onItemPickup) kart.onItemPickup();
            break;
          }
        }
      }
    },

    _updateRoulettes(dt, karts) {
      for (const kart of karts) {
        if (kart._rouletteT == null) kart._rouletteT = 0;
        if (kart._rouletteT > 0) {
          kart._rouletteT -= dt;
          if (kart._rouletteT <= 0) {
            kart._rouletteT = 0;
            const won = lotteryPick(kart.rank || 1);
            if (won === 'parfait') {
              const pool = Game.config.items.params.parfaitPool;
              kart.items = [0, 1, 2].map(() => pool[Math.floor(Math.random() * pool.length)]);
            } else {
              kart.items.push(won);
            }
            kart._itemHeldT = 0; // aiWantsToUseの強制使用タイマー
            if (kart.onItemWon) kart.onItemWon(won);
          }
        }
        if (kart.items.length > 0) {
          kart._itemHeldT = (kart._itemHeldT || 0) + dt;
        } else {
          kart._itemHeldT = 0;
        }
      }
    },

    // ---- アイテム使用 ----
    use(kart, race) {
      if (!race || race.phase === 'finished') return;
      if (kart._rouletteT > 0) return;
      if (!kart.items || kart.items.length === 0) return;
      const id = kart.items.shift();
      kart._itemHeldT = 0;
      this._activate(id, kart, race);
    },

    _activate(id, kart, race) {
      const P = Game.config.items.params;
      switch (id) {
        case 'honey': {
          kart.applyBoost(P.honeyBoostSec);
          break;
        }
        case 'scone': {
          this._spawnScone(kart);
          break;
        }
        case 'caramel': {
          this._spawnCaramel(kart);
          break;
        }
        case 'marshmallow': {
          this._spawnMarshmallow(kart, race);
          break;
        }
        case 'shield': {
          this._applyShield(kart);
          break;
        }
        case 'lemon': {
          this._spawnLemon(kart);
          break;
        }
        case 'star': {
          this._applyStar(kart);
          break;
        }
        case 'soda': {
          this._applySoda(kart, race);
          break;
        }
        case 'rainbow': {
          this._applyRainbow(kart);
          break;
        }
        case 'parfait': {
          // アイテム枠自体をparfaitPoolのランダム3連キューに差し替える(使用時点で既にshiftされているため再構築)
          const pool = P.parfaitPool;
          kart.items = [0, 1, 2].map(() => pool[Math.floor(Math.random() * pool.length)]);
          break;
        }
        default:
          break;
      }
    },

    // ---- 個別エフェクト生成 ----
    _forwardVec(kart) {
      return { x: Math.sin(kart.heading), z: Math.cos(kart.heading) };
    },

    _spawnScone(kart) {
      const P = Game.config.items.params, sh = this._shared;
      const fwd = this._forwardVec(kart);
      const mesh = new THREE.Mesh(sh.sconeGeo, sh.sconeMat);
      const startPos = new THREE.Vector3(
        kart.pos.x + fwd.x * 2.2,
        kart.roadY + ITEM_TUNING.projGroundHeight,
        kart.pos.z + fwd.z * 2.2
      );
      mesh.position.copy(startPos);
      this._scene.add(mesh);
      this._entities.push({
        type: 'scone', owner: kart, mesh,
        pos: startPos.clone(),
        vx: fwd.x * P.sconeSpeed, vz: fwd.z * P.sconeSpeed,
        life: P.sconeLifeSec, safeT: ITEM_TUNING.ownerSafeSec,
        hint: kart.progressHint,
      });
    },

    _spawnCaramel(kart) {
      const P = Game.config.items.params, sh = this._shared;
      const fwd = this._forwardVec(kart);
      const mesh = new THREE.Mesh(sh.caramelGeo, sh.caramelMat);
      const pos = new THREE.Vector3(
        kart.pos.x - fwd.x * 2.4,
        kart.roadY + 0.15,
        kart.pos.z - fwd.z * 2.4
      );
      mesh.position.copy(pos);
      this._scene.add(mesh);
      const traps = this._entities.filter((e) => e.type === 'caramel');
      if (traps.length >= Game.config.items.params.maxTraps) {
        const oldest = traps[0];
        this._removeEntity(oldest);
      }
      this._entities.push({
        type: 'caramel', owner: kart, mesh, pos: pos.clone(),
        life: P.caramelLifeSec, safeT: ITEM_TUNING.ownerSafeSec,
        hint: kart.progressHint,
      });
    },

    _spawnMarshmallow(kart, race) {
      const P = Game.config.items.params, sh = this._shared;
      const fwd = this._forwardVec(kart);
      const mesh = new THREE.Mesh(sh.marshGeo, sh.marshMat);
      const startPos = new THREE.Vector3(
        kart.pos.x + fwd.x * 2.2,
        kart.roadY + ITEM_TUNING.projGroundHeight,
        kart.pos.z + fwd.z * 2.2
      );
      mesh.position.copy(startPos);
      this._scene.add(mesh);
      const target = this._findTarget(kart, race, -1); // 1つ前の順位
      this._entities.push({
        type: 'marshmallow', owner: kart, mesh, pos: startPos.clone(),
        vx: fwd.x * P.marshmallowSpeed, vz: fwd.z * P.marshmallowSpeed,
        speed: P.marshmallowSpeed,
        target, life: P.marshmallowLifeSec, safeT: ITEM_TUNING.ownerSafeSec,
        hint: kart.progressHint,
      });
    },

    // rankOffset=-1 → 自分より1つ前の順位のカートを返す
    _findTarget(kart, race, rankOffset) {
      if (!race) return null;
      const standings = race.getStandings();
      const myIdx = standings.findIndex((s) => s.kart === kart);
      if (myIdx < 0) return null;
      const targetIdx = myIdx + rankOffset;
      if (targetIdx < 0 || targetIdx >= standings.length) return null;
      return standings[targetIdx].kart;
    },

    _applyShield(kart) {
      kart.shield = true;
      this._attachShieldVisual(kart);
      kart.onShieldBreak = () => this._removeShieldVisual(kart);
    },

    _attachShieldVisual(kart) {
      if (!kart.group) return;
      this._removeShieldVisual(kart);
      const sh = this._shared;
      const grp = new THREE.Group();
      grp.name = 'shieldVisual';
      const cookies = [];
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Mesh(sh.cookieGeo, sh.cookieMat);
        c.rotation.x = Math.PI / 2;
        grp.add(c);
        cookies.push(c);
      }
      kart.group.add(grp);
      kart._shieldVisual = { grp, cookies };
    },

    _removeShieldVisual(kart) {
      if (kart._shieldVisual && kart.group) {
        kart.group.remove(kart._shieldVisual.grp);
        kart._shieldVisual = null;
      }
    },

    _spawnLemon(kart) {
      const P = Game.config.items.params, sh = this._shared;
      const fwd = this._forwardVec(kart);
      // 前後どちらかにランダムで投げる(前方の敵/後方の敵どちらにも刺さる汎用トラップ)
      const dir = Math.random() < 0.5 ? 1 : -1;
      const mesh = new THREE.Mesh(sh.lemonGeo, sh.lemonMat);
      const startPos = new THREE.Vector3(
        kart.pos.x + fwd.x * 2.2 * dir,
        kart.pos.y + 1.0,
        kart.pos.z + fwd.z * 2.2 * dir
      );
      mesh.position.copy(startPos);
      this._scene.add(mesh);
      this._entities.push({
        type: 'lemon', owner: kart, mesh, pos: startPos.clone(),
        vx: fwd.x * P.lemonThrowSpeed * dir, vy: 6, vz: fwd.z * P.lemonThrowSpeed * dir,
        fuse: P.lemonFuseSec, safeT: ITEM_TUNING.ownerSafeSec,
        hint: kart.progressHint,
      });
    },

    _applyStar(kart) {
      const P = Game.config.items.params;
      kart.starT = Math.max(kart.starT, P.starSec);
      this._attachStarVisual(kart);
    },

    _attachStarVisual(kart) {
      if (!kart.group) return;
      if (kart._starVisual) return;
      const sh = this._shared;
      const aura = new THREE.Mesh(sh.auraGeo, sh.auraMat.clone());
      aura.name = 'starAuraVisual';
      aura.position.y = 0.7;
      kart.group.add(aura);
      kart._starVisual = aura;
    },

    _removeStarVisual(kart) {
      if (kart._starVisual && kart.group) {
        kart.group.remove(kart._starVisual);
        kart._starVisual = null;
      }
    },

    _applySoda(kart, race) {
      if (!race) return;
      const P = Game.config.items.params;
      for (const e of race.entries) {
        const other = e.kart;
        if (other === kart) continue;
        if (other.starT > 0 || other.autoT > 0) continue; // 無敵/自動走行中は無効
        if (other.shield) {
          other.shield = false;
          if (other.onShieldBreak) other.onShieldBreak();
          continue;
        }
        other.applySpin();
        other.slowT = Math.max(other.slowT, P.sodaSlowSec);
      }
    },

    _applyRainbow(kart) {
      const P = Game.config.items.params;
      kart.autoT = P.rainbowSec;
      kart.starT = Math.max(kart.starT, P.rainbowSec);
      kart.applyBoost(P.rainbowSec);
      this._attachStarVisual(kart);
    },

    // レインボースプリンクル中の自動走行入力。RaceManagerからkart.autoT>0の間毎フレーム呼ばれる。
    autoInput(dt, kart, course, race) {
      if (!this._aiController.has(kart)) {
        this._aiController.set(kart, new Game.AIController(kart));
      }
      const ai = this._aiController.get(kart);
      const base = ai.getInput(dt, kart, course, race);
      return {
        throttle: 1, brake: 0, steer: base.steer,
        drift: false, driftPressed: false,
        itemPressed: false, pausePressed: false,
      };
    },

    // ---- エンティティ(発射体/トラップ/投擲物)更新 ----
    _updateEntities(dt, karts, race) {
      for (let i = this._entities.length - 1; i >= 0; i--) {
        const e = this._entities[i];
        if (e.safeT > 0) e.safeT -= dt;

        let dead = false;
        if (e.type === 'scone') dead = this._stepScone(e, dt, karts);
        else if (e.type === 'caramel') dead = this._stepCaramel(e, dt, karts);
        else if (e.type === 'marshmallow') dead = this._stepMarshmallow(e, dt, karts, race);
        else if (e.type === 'lemon') dead = this._stepLemon(e, dt, karts);

        if (dead) this._removeEntity(e);
      }
    },

    _queryGround(e) {
      const q = this._course.query(e.pos, e.hint);
      e.hint = q.idx;
      return q;
    },

    _checkKartHits(e, karts, radius) {
      for (const kart of karts) {
        if (kart === e.owner && e.safeT > 0) continue;
        if (kart.finished) continue;
        const dx = kart.pos.x - e.pos.x, dz = kart.pos.z - e.pos.z;
        const dy = Math.abs(kart.pos.y - e.pos.y);
        if (dy > 2.2) continue;
        if (Math.hypot(dx, dz) <= radius) return kart;
      }
      return null;
    },

    _stepScone(e, dt, karts) {
      e.pos.x += e.vx * dt; e.pos.z += e.vz * dt;
      e.life -= dt;
      const q = this._queryGround(e);
      e.pos.y = q.roadY + ITEM_TUNING.projGroundHeight;
      e.mesh.position.copy(e.pos);
      // 壁の外(コース外の限界を超える)に出たら消滅
      if (q.wall && Math.abs(q.lateral) > q.limit + ITEM_TUNING.wallLateralMargin) return true;
      if (e.life <= 0) return true;
      const hit = this._checkKartHits(e, karts, ITEM_TUNING.hitRadius);
      if (hit) { hit.applySpin(); return true; }
      return false;
    },

    _stepCaramel(e, dt, karts) {
      e.life -= dt;
      if (e.life <= 0) return true;
      const hit = this._checkKartHits(e, karts, ITEM_TUNING.trapHitRadius);
      if (hit) {
        hit.applySpin();
        hit.slowT = Math.max(hit.slowT, Game.config.items.params.caramelSlowSec);
        return true;
      }
      return false;
    },

    _stepMarshmallow(e, dt, karts, race) {
      e.life -= dt;
      if (e.life <= 0) return true;
      const U = Game.U;
      // 対象消失(完走/存在しない)時は直進
      if (e.target && (e.target.finished || !karts.includes(e.target))) e.target = null;
      if (e.target) {
        const dx = e.target.pos.x - e.pos.x, dz = e.target.pos.z - e.pos.z;
        const desired = Math.atan2(dx, dz);
        const curAngle = Math.atan2(e.vx, e.vz);
        const newAngle = U.angleDamp(curAngle, desired, Game.config.items.params.marshmallowTurn * ITEM_TUNING.marshTurnEase * 0.25, dt);
        e.vx = Math.sin(newAngle) * e.speed;
        e.vz = Math.cos(newAngle) * e.speed;
      }
      e.pos.x += e.vx * dt; e.pos.z += e.vz * dt;
      const q = this._queryGround(e);
      e.pos.y = q.roadY + ITEM_TUNING.projGroundHeight;
      e.mesh.position.copy(e.pos);
      const hit = this._checkKartHits(e, karts, ITEM_TUNING.hitRadius);
      if (hit) { hit.applySpin(); return true; }
      return false;
    },

    _stepLemon(e, dt, karts) {
      e.fuse -= dt;
      e.vy -= ITEM_TUNING.lemonArcGravity * dt;
      e.pos.x += e.vx * dt; e.pos.y += e.vy * dt; e.pos.z += e.vz * dt;
      e.mesh.position.copy(e.pos);
      const q = this._queryGround(e);
      let landed = e.pos.y <= q.roadY + 0.2 && e.vy <= 0;
      const hit = this._checkKartHits(e, karts, ITEM_TUNING.hitRadius);
      if (landed || hit || e.fuse <= 0) {
        this._explodeLemon(e, karts);
        return true;
      }
      return false;
    },

    _explodeLemon(e, karts) {
      const P = Game.config.items.params;
      const radius = P.lemonBlastRadius + ITEM_TUNING.lemonBlastFudge;
      for (const kart of karts) {
        if (kart === e.owner && e.safeT > 0) continue;
        const dx = kart.pos.x - e.pos.x, dz = kart.pos.z - e.pos.z;
        const dy = Math.abs(kart.pos.y - e.pos.y);
        if (dy > 3) continue;
        if (Math.hypot(dx, dz) <= radius) kart.applyHit(1);
      }
      this._spawnBlastFx(e.pos);
    },

    _spawnBlastFx(pos) {
      const sh = this._shared;
      const mesh = new THREE.Mesh(sh.blastGeo, sh.blastMat.clone());
      mesh.position.copy(pos);
      mesh.scale.setScalar(0.1);
      this._scene.add(mesh);
      this._entities.push({ type: 'blastFx', mesh, pos: pos.clone(), life: 0.4, growTo: Game.config.items.params.lemonBlastRadius });
    },

    _removeEntity(e) {
      if (e.mesh) this._scene.remove(e.mesh);
      const idx = this._entities.indexOf(e);
      if (idx >= 0) this._entities.splice(idx, 1);
    },

    // ---- AI使用判断 ----
    aiWantsToUse(kart, race, dt) {
      if (!kart.items || kart.items.length === 0) return false;
      if (kart._aiItemCd == null) kart._aiItemCd = this._randCd();
      kart._aiItemCd -= (dt || 0);
      const forced = (kart._itemHeldT || 0) >= ITEM_TUNING.aiForceUseSec;
      if (kart._aiItemCd > 0 && !forced) return false;

      const id = kart.items[0];
      const want = this._aiWantsId(id, kart, race);
      if (want || forced) {
        kart._aiItemCd = this._randCd();
        return true;
      }
      return false;
    },

    _randCd() {
      return ITEM_TUNING.aiCdMin + Math.random() * (ITEM_TUNING.aiCdMax - ITEM_TUNING.aiCdMin);
    },

    _aiWantsId(id, kart, race) {
      const rank = kart.rank || 8;
      const lastLap = race && kart.lap === race.laps;
      switch (id) {
        case 'honey':
          return this._frontIsStraight(kart) || rank >= ITEM_TUNING.aiLowRankThresh;
        case 'scone':
        case 'marshmallow':
          return this._enemyWithin(kart, race, ITEM_TUNING.aiFrontRange, true);
        case 'caramel':
        case 'lemon':
          return this._enemyWithin(kart, race, ITEM_TUNING.aiRearRange, false) || lastLap;
        case 'shield':
        case 'star':
          return true;
        case 'soda':
        case 'rainbow':
        case 'parfait':
          return rank >= ITEM_TUNING.aiBackRankThresh || lastLap;
        default:
          return false;
      }
    },

    _frontIsStraight(kart) {
      if (!this._course || !kart) return true;
      const s = this._course.spline;
      const hintIdx = kart.progressHint ?? 0;
      const a0 = s.tangentAngle(hintIdx);
      const a1 = s.tangentAngle((hintIdx + 14) % s.count);
      return Math.abs(Game.U.wrapAngle(a1 - a0)) < 0.12;
    },

    _enemyWithin(kart, race, range, ahead) {
      if (!race) return false;
      for (const e of race.entries) {
        const other = e.kart;
        if (other === kart || other.finished) continue;
        const dist = race.trackDistance(other, kart); // 正=otherが前
        if (ahead && dist > 0 && dist <= range) return true;
        if (!ahead && dist < 0 && -dist <= range) return true;
      }
      return false;
    },
  };

  // blastFxのライフサイクルだけは軽量に別枠更新(update内の_updateEntitiesに混ぜず、汎用エンティティループへ寄せる)
  const origUpdateEntities = Game.items._updateEntities;
  Game.items._updateEntities = function (dt, karts, race) {
    origUpdateEntities.call(this, dt, karts, race);
    for (let i = this._entities.length - 1; i >= 0; i--) {
      const e = this._entities[i];
      if (e.type !== 'blastFx') continue;
      e.life -= dt;
      const t = Game.U.clamp(1 - e.life / 0.4, 0, 1);
      e.mesh.scale.setScalar(0.1 + t * e.growTo);
      e.mesh.material.opacity = 0.55 * (1 - t);
      if (e.life <= 0) this._removeEntity(e);
    }
  };

  // starT/shieldのビジュアル後始末(starTが切れたらオーラを消す、シールドが破壊されたら見た目除去)
  // kart.update()は本モジュールの外で呼ばれるため、update()内で全カートのstarT状態を監視して同期する。
  const origUpdate = Game.items.update;
  Game.items.update = function (dt, race) {
    origUpdate.call(this, dt, race);
    if (race && race.entries) {
      for (const e of race.entries) {
        const kart = e.kart;
        if (kart._starVisual) {
          if (kart.starT > 0) {
            const pulse = 0.22 + 0.12 * Math.sin(this._time * ITEM_TUNING.starAuraPulseSpeed);
            kart._starVisual.material.opacity = pulse;
            const hue = (this._time * 0.6) % 1;
            kart._starVisual.material.color.setHSL(hue, 0.9, 0.7);
          } else {
            this._removeStarVisual(kart);
          }
        }
        if (kart._shieldVisual) {
          if (kart.shield) {
            const v = kart._shieldVisual;
            v.grp.rotation.y += ITEM_TUNING.shieldOrbitSpeed * dt;
            v.cookies.forEach((c, i) => {
              const a = (i / v.cookies.length) * Math.PI * 2;
              c.position.set(
                Math.cos(a) * ITEM_TUNING.shieldOrbitRadius,
                ITEM_TUNING.shieldOrbitHeight,
                Math.sin(a) * ITEM_TUNING.shieldOrbitRadius
              );
            });
          } else {
            this._removeShieldVisual(kart);
          }
        }
      }
    }
  };
})();
