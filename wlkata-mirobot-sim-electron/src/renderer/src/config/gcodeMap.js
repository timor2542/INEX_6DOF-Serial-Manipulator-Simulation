// src/config/gcodeMap.js
export const fwProfile = {
  name: 'WLKATA_Mirobot',
  axes: {
    jointKeys: ['J1', 'J2', 'J3', 'J4', 'J5', 'J6', 'J7'],
    linearKeys: ['X', 'Y', 'Z'],
    angularKeys: ['A', 'B', 'C'],
  },
  // === J7 profile ===
  j7: {
    mode: 'linear',          // 'joint' | 'linear' | 'custom'
    linearKey: 'U',          // ใช้เมื่อ mode = 'linear'
    custom: {                // ใช้เมื่อ mode = 'custom'
      cw: 'M201', ccw: 'M202', stop: 'M203',
      speedArg: 'S', stepSpeed: 50
    }
  },
  // === ตัวเลือกการแสดงผล ===
  ui: {
    showJointsInCoord: true, // โชว์แถว J1..J6 ในหน้า Coord ด้วย (กด –/+)
  },
  cmds: {
    homing: 'G28',
    zeroAll: 'G92 X0 Y0 Z0 A0 B0 C0',
    stop: 'M112',
    gripperOn: 'M3',
    gripperOff: 'M5',
    blow: 'M7',
  },
  feedDefaults: { jog: 2000 }
};
