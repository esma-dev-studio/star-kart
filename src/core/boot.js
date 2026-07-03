// シュガリア・グランプリ 名前空間
window.Game = {
  VERSION: '0.1.0',
  state: 'boot',
};

// レンダラをsRGB出力にするため、色テクスチャ(CanvasTexture)は常にsRGBとして扱う
if (typeof THREE !== 'undefined' && THREE.sRGBEncoding !== undefined) {
  const OrigCanvasTexture = THREE.CanvasTexture;
  THREE.CanvasTexture = class CanvasTexture extends OrigCanvasTexture {
    constructor(...args) {
      super(...args);
      this.encoding = THREE.sRGBEncoding;
    }
  };
}

// 互換シム: CapsuleGeometryはr134コアに無いため、LatheGeometryで同等品を定義する
if (typeof THREE !== 'undefined' && !THREE.CapsuleGeometry) {
  THREE.CapsuleGeometry = class CapsuleGeometry extends THREE.LatheGeometry {
    constructor(radius = 1, length = 1, capSegments = 4, radialSegments = 8) {
      const pts = [];
      for (let i = 0; i <= capSegments; i++) {
        const a = -Math.PI / 2 + (i / capSegments) * (Math.PI / 2);
        pts.push(new THREE.Vector2(Math.cos(a) * radius, -length / 2 + Math.sin(a) * radius));
      }
      for (let i = 0; i <= capSegments; i++) {
        const a = (i / capSegments) * (Math.PI / 2);
        pts.push(new THREE.Vector2(Math.cos(a) * radius, length / 2 + Math.sin(a) * radius));
      }
      super(pts, radialSegments);
    }
  };
}
