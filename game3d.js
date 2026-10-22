import * as THREE from 'three';

const CELL = 4;
const WALL_HEIGHT = 4.5;
const ZOMBIE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x526047, roughness: 0.94 });
const METAL = new THREE.MeshStandardMaterial({ color: 0x252b29, metalness: 0.72, roughness: 0.4 });
const STEEL = new THREE.MeshStandardMaterial({ color: 0x747b71, metalness: 0.8, roughness: 0.3 });
const WOOD = new THREE.MeshStandardMaterial({ color: 0x64472f, roughness: 0.88 });

export function createWorld3D(bridge) {
  const canvas = document.getElementById('world3d');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.1));
  renderer.setSize(innerWidth, innerHeight, false);
  renderer.shadowMap.enabled = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101511);
  scene.fog = new THREE.FogExp2(0x111813, 0.009);
  const camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.08, 180);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  const ambientLight = new THREE.HemisphereLight(0xb7c8ad, 0x211c17, .32);
  scene.add(ambientLight);
  const key = new THREE.DirectionalLight(0xe0d2ab, .35);
  key.position.set(-24, 38, -18);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -58; key.shadow.camera.right = 58;
  key.shadow.camera.top = 52; key.shadow.camera.bottom = -52;
  scene.add(key);

  const mapHeight = bridge.map.length;
  const mapWidth = bridge.map[0].length;
  const worldX = x => (x - mapWidth / 2) * CELL;
  const worldZ = y => (y - mapHeight / 2) * CELL;
  const worldPosition = (x, y, height = 0) => new THREE.Vector3(worldX(x), height, worldZ(y));

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(mapWidth * CELL, mapHeight * CELL),
    new THREE.MeshStandardMaterial({ color: 0x454239, roughness: 0.93, metalness: 0.04 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.08, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(mapWidth * CELL, mapHeight * CELL),
    new THREE.MeshStandardMaterial({ color: 0x292d27, roughness: 1, side: THREE.DoubleSide })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = WALL_HEIGHT;
  scene.add(ceiling);

  const wallMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x535b51, roughness: 0.94 }),
    new THREE.MeshStandardMaterial({ color: 0x786047, roughness: 0.96 }),
    new THREE.MeshStandardMaterial({ color: 0x424a43, roughness: 0.92 })
  ];
  const wallGeometry = new THREE.BoxGeometry(CELL, WALL_HEIGHT, CELL);
  const wallGroup = new THREE.Group();
  const wallTrimGeometry = new THREE.BoxGeometry(CELL * .9, .1, .08);
  const barrierBoardGeometry = new THREE.BoxGeometry(CELL * .78, .24, .2);
  function rebuildMap() {
    wallGroup.clear();
    for (let y = 0; y < mapHeight; y++) {
      for (let x = 0; x < mapWidth; x++) {
        const tile = bridge.map[y][x];
        if (tile === 1) {
          const wall = new THREE.Mesh(wallGeometry, wallMaterials[(x * 3 + y) % wallMaterials.length]);
          wall.position.set(worldX(x + 0.5), WALL_HEIGHT / 2, worldZ(y + 0.5));
          wallGroup.add(wall);
          if ((x + y) % 3 === 0) {
            const trim = new THREE.Mesh(wallTrimGeometry, STEEL);
            trim.position.set(worldX(x + .5), 1.08, worldZ(y + .5) + CELL * .5);
            wallGroup.add(trim);
          }
        } else if (tile === 3) {
          for (let plank = 0; plank < 3; plank++) {
            const board = new THREE.Mesh(barrierBoardGeometry, WOOD);
            board.position.set(worldX(x + .5), .58 + plank * .55, worldZ(y + .5));
            wallGroup.add(board);
          }
        }
      }
    }
  }
  rebuildMap(); scene.add(wallGroup);

  const doorMeshes = bridge.doors.map((door, index) => {
    const group = new THREE.Group();
    const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x59462e, roughness: .9 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(CELL * .88, WALL_HEIGHT * .79, .34), doorMaterial);
    panel.position.y = WALL_HEIGHT * .395;
    panel.castShadow = true;
    group.add(panel);
    for (let plank = 0; plank < 5; plank++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(CELL * .82, .11, .42), STEEL);
      bar.position.set(0, .45 + plank * .7, 0);
      group.add(bar);
    }
    const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x343a33, metalness: .5, roughness: .6 });
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.2, WALL_HEIGHT, .6), frameMaterial);
      post.position.set(side * CELL * .48, WALL_HEIGHT / 2, 0);
      group.add(post);
    }
    group.position.set(worldPosition(door.x, door.y).x, 0, worldPosition(door.x, door.y).z);
    group.rotation.y = Math.PI / 2;
    group.visible = !door.open;
    group.userData.doorIndex = index;
    scene.add(group);
    return group;
  });

  const barrierGroup = new THREE.Group();
  const barrierPos = worldPosition(bridge.barrier.x, bridge.barrier.y);
  for (let plank = 0; plank < bridge.barrier.max; plank++) {
    const board = new THREE.Mesh(new THREE.BoxGeometry(2.8, .24, .2), WOOD);
    board.position.set((plank % 2) * .35 - .18, .7 + Math.floor(plank / 2) * .62, (plank % 2) * .23);
    board.rotation.y = plank % 2 ? -.08 : .08;
    board.castShadow = true;
    barrierGroup.add(board);
  }
  barrierGroup.position.set(barrierPos.x, 0, barrierPos.z);
  scene.add(barrierGroup);

  const pointLights = [];
  for (const [x, y, color] of [[4, 4, 0xffd18a], [12, 3, 0xb3d6aa], [12, 13, 0xe39c67], [20, 4, 0xc2d0a0], [20, 14, 0xd5aa73]]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(.42, .12, .42), new THREE.MeshStandardMaterial({ color: 0xe0d8bc, emissive: color, emissiveIntensity: .5 }));
    lamp.position.set(worldX(x), WALL_HEIGHT - .16, worldZ(y));
    scene.add(lamp);
    const light = new THREE.PointLight(color, 42, CELL * 6, 1.6);
    light.position.copy(lamp.position).y -= .4;
    light.castShadow = false;
    scene.add(light);
    pointLights.push(light);
  }

  const stationMeshes = new Map();
  const crateMaterial = new THREE.MeshStandardMaterial({ color: 0x5a442d, roughness: .85 });
  const glowingMaterial = color => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .55, roughness: .4 });
  function makeStation(station) {
    const group = new THREE.Group();
    if (station.kind === 'box') {
      const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 1.3), crateMaterial);
      base.position.y = .62; base.castShadow = true; group.add(base);
      const trim = new THREE.Mesh(new THREE.BoxGeometry(2.3, .13, 1.4), new THREE.MeshStandardMaterial({ color: 0xc09a55, metalness: .48 }));
      trim.position.y = 1.16; group.add(trim);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(2.25, .16, 1.36), crateMaterial);
      lid.position.set(0, 1.28, 0); lid.name = 'lid'; group.add(lid);
      const window = new THREE.Mesh(new THREE.BoxGeometry(1.5, .5, .06), glowingMaterial(0x55cbc3));
      window.position.set(0, .69, .68); group.add(window);
    } else if (station.kind === 'perk') {
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(.48, .55, 2.45, 12), new THREE.MeshStandardMaterial({ color: 0x242b26, metalness: .3, roughness: .58 }));
      shell.position.y = 1.22; shell.castShadow = true; group.add(shell);
      const light = new THREE.Mesh(new THREE.SphereGeometry(.23, 16, 12), glowingMaterial(new THREE.Color(station.color).getHex()));
      light.position.set(0, 1.42, .48); group.add(light);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(.52, .52, .15, 12), STEEL);
      cap.position.y = 2.42; group.add(cap);
    } else if (station.kind === 'power') {
      const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, .5), new THREE.MeshStandardMaterial({ color: 0x343b35, metalness: .52, roughness: .54 }));
      cabinet.position.y = .9; cabinet.castShadow = true; group.add(cabinet);
      const switchLever = new THREE.Mesh(new THREE.BoxGeometry(.16, .65, .17), new THREE.MeshStandardMaterial({ color: 0xa94034, metalness: .35 }));
      switchLever.position.set(0, 1, .3); switchLever.name = 'lever'; group.add(switchLever);
      const indicator = new THREE.Mesh(new THREE.SphereGeometry(.12, 12, 10), glowingMaterial(0xe14737));
      indicator.position.set(0, 1.56, .29); indicator.name = 'indicator'; group.add(indicator);
    } else {
      const rack = new THREE.Mesh(new THREE.BoxGeometry(1.45, 1.8, .4), crateMaterial);
      rack.position.y = .95; rack.castShadow = true; group.add(rack);
      const rail = new THREE.Mesh(new THREE.BoxGeometry(1.1, .1, .12), STEEL);
      rail.position.set(0, 1.52, .25); group.add(rail);
    }
    const p = worldPosition(station.x, station.y);
    group.position.set(p.x, 0, p.z);
    group.userData.kind = station.kind;
    scene.add(group);
    stationMeshes.set(station, group);
  }
  bridge.stations.forEach(makeStation);

  const weaponMaterial = color => new THREE.MeshStandardMaterial({ color, metalness: .62, roughness: .35 });
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x68472e, roughness: .78 });
  const pistolDark = weaponMaterial(0x202724);
  const muzzleLight = new THREE.PointLight(0xffb35b, 0, 2.6, 2);
  camera.add(muzzleLight);
  const muzzleFlash = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffc369 }));
  muzzleFlash.position.set(0, 0, -.7); muzzleFlash.visible = false; camera.add(muzzleFlash);

  function buildWeapon(gun, side = 0) {
    const group = new THREE.Group();
    const pistol = gun.style === 'pistol';
    const shotgun = gun.style === 'shotgun' || gun.style === 'double';
    const heavy = ['mg42', 'browning', 'dp', 'bar'].includes(gun.style);
    const mainLength = gun.style === 'launcher' ? 1.42 : gun.style === 'ptrs' ? 1.3 : shotgun ? 1.05 : pistol ? .48 : heavy ? 1.08 : .86;
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(pistol ? .22 : .3, pistol ? .13 : .19, pistol ? .42 : .55), pistol ? pistolDark : (['mp40','mg42','browning','ptrs','dp'].includes(gun.style) ? METAL : woodMaterial));
    receiver.position.set(0, 0, -.08); receiver.castShadow = true; group.add(receiver);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(pistol ? .14 : .18, pistol ? .31 : .39, .17), woodMaterial);
    grip.position.set(0, -.2, .06); grip.rotation.x = -.16; grip.castShadow = true; group.add(grip);
    const barrelRadius = gun.style === 'launcher' ? .17 : gun.style === 'flame' ? .11 : heavy ? .075 : .052;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(barrelRadius, barrelRadius * 1.18, mainLength, 10), pistolDark);
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, .055, -mainLength * .58); barrel.castShadow = true; group.add(barrel);
    const frontSight = new THREE.Mesh(new THREE.BoxGeometry(.045, .13, .055), STEEL);
    frontSight.position.set(0, .15, -mainLength * .98); group.add(frontSight);

    if (pistol) {
      const slide = new THREE.Mesh(new THREE.BoxGeometry(.23, .08, .38), STEEL);
      slide.position.set(0, .105, -.09); group.add(slide);
      const hammer = new THREE.Mesh(new THREE.BoxGeometry(.08, .08, .08), pistolDark);
      hammer.position.set(0, .15, .12); group.add(hammer);
    } else if (gun.style === 'ppsh') {
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(.29, .29, .16, 20), pistolDark);
      drum.rotation.x = Math.PI / 2; drum.position.set(0, -.29, -.04); group.add(drum);
      const jacket = new THREE.Mesh(new THREE.CylinderGeometry(.105, .1, .44, 16), STEEL);
      jacket.rotation.x = Math.PI / 2; jacket.position.set(0, .02, -.55); group.add(jacket);
    } else if (gun.style === 'thompson') {
      const magazine = new THREE.Mesh(new THREE.BoxGeometry(.13, .42, .16), pistolDark);
      magazine.position.set(0, -.29, -.08); group.add(magazine);
      const comp = new THREE.Mesh(new THREE.BoxGeometry(.14, .2, .12), STEEL);
      comp.position.set(0, .045, -mainLength * .95); group.add(comp);
    } else if (gun.style === 'dp') {
      const pan = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .15, 24), pistolDark);
      pan.position.set(0, .2, -.02); group.add(pan);
    } else if (gun.style === 'mg42' || gun.style === 'browning') {
      const feed = new THREE.Mesh(new THREE.BoxGeometry(.18, .11, .56), new THREE.MeshStandardMaterial({ color: 0x9c804d, metalness: .52 }));
      feed.position.set(.23, .1, -.12); group.add(feed);
      for (const x of [-.19, .19]) {
        const bipod = new THREE.Mesh(new THREE.CylinderGeometry(.025, .035, .63, 6), METAL);
        bipod.position.set(x, -.39, -.35); bipod.rotation.z = x < 0 ? -.18 : .18; group.add(bipod);
      }
    } else if (gun.style === 'double') {
      barrel.scale.x = 1; barrel.position.x = -.09;
      const secondBarrel = barrel.clone(); secondBarrel.position.x = .09; group.add(secondBarrel);
    } else if (gun.style === 'scoped' || gun.style === 'ptrs') {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .58, 10), pistolDark);
      scope.rotation.x = Math.PI / 2; scope.position.set(0, .18, -.18); group.add(scope);
      for (const z of [-.43, .08]) {
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .08, 12), STEEL);
        ring.rotation.x = Math.PI / 2; ring.position.set(0, .18, z); group.add(ring);
      }
    } else if (gun.style === 'launcher') {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(.23, .23, 1.25, 12), METAL);
      tube.rotation.x = Math.PI / 2; tube.position.z = -.55; group.add(tube);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(.22, .035, 6, 16), STEEL);
      rim.position.z = -1.2; group.add(rim);
    } else if (gun.style === 'flame') {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(.16, .18, .58, 12), new THREE.MeshStandardMaterial({ color: 0x6e5130, metalness: .25 }));
      tank.position.set(-.22, -.14, .06); group.add(tank);
      const hose = new THREE.Mesh(new THREE.TorusGeometry(.2, .025, 6, 16, Math.PI), STEEL);
      hose.position.set(-.06, -.06, .14); group.add(hose);
    } else {
      const magazineGeometry = gun.style === 'arisaka' || gun.style === 'stg' ? new THREE.BoxGeometry(.13, .48, .17) : new THREE.BoxGeometry(.13, .32, .16);
      const magazine = new THREE.Mesh(magazineGeometry, pistolDark);
      magazine.position.set(0, -.26, -.05); magazine.rotation.x = -.12; group.add(magazine);
      if (gun.style === 'bar') {
        const carry = new THREE.Mesh(new THREE.BoxGeometry(.38, .055, .1), METAL);
        carry.position.set(0, .16, -.12); group.add(carry);
      }
      if (gun.style === 'bolt' || gun.style === 'arisaka') {
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(.026, .026, .23, 8), STEEL);
        bolt.rotation.z = Math.PI / 2; bolt.position.set(.18, .03, -.05); group.add(bolt);
      }
    }
    group.position.set(side * .34, -.31, -.68);
    group.rotation.set(-.08, side * -.08, side * -.08);
    return group;
  }

  let weaponGroups = [];
  let currentGun = -1;
  function syncWeapon() {
    if (currentGun === bridge.gunIndex) return;
    for (const weapon of weaponGroups) camera.remove(weapon);
    weaponGroups = [];
    currentGun = bridge.gunIndex;
    const gun = bridge.guns[currentGun];
    if (gun.style === 'pistol' && gun.name === 'M1911') {
      weaponGroups.push(buildWeapon(gun, -1), buildWeapon(gun, 1));
    } else weaponGroups.push(buildWeapon(gun, .45));
    for (const weapon of weaponGroups) camera.add(weapon);
  }

  const zombieMeshes = new Map();
  const zombieRayTargets = [];
  function makeZombie(zombie) {
    const group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: zombie.crawler ? 0x655b4b : 0x69775a, roughness: .92 });
    const cloth = new THREE.MeshStandardMaterial({ color: zombie.crawler ? 0x343c34 : 0x3c4639, roughness: .96 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(zombie.crawler ? .8 : .72, zombie.crawler ? .4 : 1.05, .48), cloth);
    torso.position.y = zombie.crawler ? .43 : 1.02; torso.rotation.z = zombie.crawler ? -.15 : -.06;
    torso.castShadow = true; group.add(torso); torso.userData = { zombie, part: 'body' }; zombieRayTargets.push(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(zombie.crawler ? .22 : .28, 14, 12), skin);
    head.position.set(.03, zombie.crawler ? .7 : 1.82, -.02); head.castShadow = true;
    head.userData = { zombie, part: 'head' }; group.add(head); zombieRayTargets.push(head);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xee604b });
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), eyeMaterial);
      eye.position.set(side * .095, zombie.crawler ? .72 : 1.86, -.24); group.add(eye);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.12, zombie.crawler ? .32 : .56, 3, 6), cloth);
      leg.position.set(side * .23, zombie.crawler ? .18 : .37, .18); leg.name = `leg${side}`; leg.castShadow = true; group.add(leg);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.095, zombie.crawler ? .38 : .5, 3, 6), skin);
      arm.position.set(side * (zombie.crawler ? .47 : .5), zombie.crawler ? .25 : 1.02, -.03);
      arm.name = `arm${side}`; arm.castShadow = true; group.add(arm);
    }
    group.userData.zombie = zombie;
    scene.add(group);
    zombieMeshes.set(zombie, group);
    return group;
  }

  const raycaster = new THREE.Raycaster();
  raycaster.far = 48;
  const clock = new THREE.Clock();
  function update() {
    const { player, zombies, doors, stations, barrier, powerOn, gunIndex, aimAmount, recoil, muzzle, movementAmount, shotSide } = bridge;
    camera.position.set(worldX(player.x), 1.68, worldZ(player.y));
    camera.rotation.y = -Math.PI / 2 - player.angle;
    camera.rotation.x = player.pitch;
    camera.fov = THREE.MathUtils.lerp(76, 59, aimAmount);
    camera.updateProjectionMatrix();
    ambientLight.intensity = powerOn ? 1.15 : .32;
    key.intensity = powerOn ? 2 : .35;
    for (const light of pointLights) light.intensity = powerOn ? 42 : 1.8;
    syncWeapon();
    const now = performance.now() * .001;
    weaponGroups.forEach((weapon, index) => {
      const side = weapon.position.x < 0 ? -1 : 1;
      const firingPistol = gunIndex === 21 && index === shotSide;
      weapon.position.y = -.31 + Math.sin(now * 8 + index) * movementAmount * .035 - recoil * (firingPistol ? .0014 : .00035);
      weapon.position.x = side * (gunIndex === 21 ? .34 : .45) + Math.sin(now * 6 + index) * movementAmount * .014;
      weapon.rotation.x = -.08 + aimAmount * .04 + (firingPistol ? recoil * .002 : 0);
    });
    muzzleFlash.visible = muzzle > .08;
    muzzleLight.intensity = muzzle * 8;
    for (let i = 0; i < doors.length; i++) doorMeshes[i].visible = !doors[i].open;
    barrierGroup.visible = barrier.health > 0;
    for (const station of stations) {
      const group = stationMeshes.get(station);
      if (!group) continue;
      if (station.kind === 'box') {
        const lid = group.getObjectByName('lid');
        if (lid) lid.rotation.x = station.rolling ? Math.sin(now * 14) * .35 : Math.sin(now * 1.4) * .025;
        const light = group.children.find(child => child.geometry.type === 'BoxGeometry' && child.position.z > .5);
        if (light?.material) light.material.emissiveIntensity = station.active ? .4 + Math.sin(now * 4) * .25 : .04;
      }
      if (station.kind === 'power') {
        const lever = group.getObjectByName('lever');
        const indicator = group.getObjectByName('indicator');
        if (lever) lever.rotation.x = powerOn ? -.52 : .52;
        if (indicator) indicator.material.emissive.setHex(powerOn ? 0x70e38e : 0xe14737);
      }
    }
    for (const zombie of zombies) {
      const group = zombieMeshes.get(zombie) || makeZombie(zombie);
      group.position.set(worldX(zombie.x), 0, worldZ(zombie.y));
      const dx = player.x - zombie.x, dy = player.y - zombie.y;
      group.rotation.y = Math.atan2(-dx, -dy);
      const stride = Math.sin(zombie.step * 8) * .45;
      for (const child of group.children) {
        if (child.name.startsWith('leg')) child.rotation.x = stride * (child.name.endsWith('1') ? 1 : -1);
        if (child.name.startsWith('arm')) child.rotation.x = zombie.crawler ? Math.sin(zombie.step * 7) * .5 : -stride * .35;
      }
    }
    for (const [zombie, group] of zombieMeshes) {
      if (zombies.includes(zombie)) continue;
      scene.remove(group);
      for (let i = zombieRayTargets.length - 1; i >= 0; i--) {
        if (zombieRayTargets[i].userData.zombie === zombie) zombieRayTargets.splice(i, 1);
      }
      zombieMeshes.delete(zombie);
    }
  }

  function shoot() {
    const { player, aimAmount } = bridge;
    camera.position.set(worldX(player.x), 1.68, worldZ(player.y));
    camera.rotation.y = -Math.PI / 2 - player.angle;
    camera.rotation.x = player.pitch;
    camera.fov = THREE.MathUtils.lerp(76, 59, aimAmount);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hit = raycaster.intersectObjects(zombieRayTargets, false)[0];
    if (!hit) return null;
    const horizontalFactor = Math.max(.25, Math.cos(player.pitch));
    const wall = bridge.rayDistance(player.angle, raycaster.far / (CELL * horizontalFactor));
    if (wall.distance * CELL / horizontalFactor < hit.distance - .1) return null;
    return { zombie: hit.object.userData.zombie, headshot: hit.object.userData.part === 'head' };
  }

  function render() {
    update();
    renderer.render(scene, camera);
  }

  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  function dispose() {
    removeEventListener('resize', resize);
    scene.traverse(object => {
      object.geometry?.dispose();
      if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
      else object.material?.dispose();
    });
    renderer.dispose();
  }

  return { render, shoot, dispose, rebuildMap, scene, camera, renderer };
}