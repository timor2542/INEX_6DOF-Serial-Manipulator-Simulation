// src/utils/gcode.js
import { fwProfile } from '../config/gcodeMap.js';

const fmt = (n) => Number(n ?? 0).toFixed(2);

export function buildJointMove(jArr) {
  const keys = fwProfile.axes.jointKeys;
  const parts = [];
  for (let i = 0; i < Math.min(keys.length, jArr.length); i++) {
    if (typeof jArr[i] === 'number') parts.push(`${keys[i]}=${fmt(jArr[i])}`);
  }
  return `G0 ${parts.join(' ')}\n`;
}

export function buildLinearMove(cart, F) {
  const keys = fwProfile.axes.linearKeys;
  const parts = keys.map(k => `${k}=${fmt(cart[k])}`);
  return `G1 ${parts.join(' ')} F=${Math.max(1, F || fwProfile.feedDefaults.jog)}\n`;
}

export function buildAngularMove(ang, F) {
  const map = { Rx: 'A', Ry: 'B', Rz: 'C' };
  const parts = fwProfile.axes.angularKeys.map(k => {
    const inv = Object.keys(map).find(mk => map[mk] === k);
    return `${k}=${fmt(ang[inv])}`;
  });
  return `G1 ${parts.join(' ')} F=${Math.max(1, F || fwProfile.feedDefaults.jog)}\n`;
}

export const GCODE_CMD = {
  homing: () => fwProfile.cmds.homing + '\n',
  zeroAll: () => fwProfile.cmds.zeroAll + '\n',
  stop: () => fwProfile.cmds.stop + '\n',
  gripOn: () => fwProfile.cmds.gripperOn + '\n',
  gripOff: () => fwProfile.cmds.gripperOff + '\n',
  blow: () => fwProfile.cmds.blow ? fwProfile.cmds.blow + '\n' : '',
};

/** ส่ง J7 ตามโปรไฟล์ (joint / linear / custom) */
export function buildJ7ByProfile(j7ValueOrDelta, feed) {
  const { j7 } = fwProfile;

  if (j7.mode === 'joint') {
    return `G0 J7=${fmt(j7ValueOrDelta)}\n`;
  }
  if (j7.mode === 'linear') {
    const key = j7.linearKey || 'U';
    return `G1 ${key}=${fmt(j7ValueOrDelta)} F=${Math.max(1, feed || fwProfile.feedDefaults.jog)}\n`;
  }
  if (j7.mode === 'custom') {
    const sp = Math.abs(j7ValueOrDelta);
    if (j7ValueOrDelta > 0) return `${j7.custom.cw}${j7.custom.speedArg ? ` ${j7.custom.speedArg}${sp}` : ''}\n`;
    if (j7ValueOrDelta < 0) return `${j7.custom.ccw}${j7.custom.speedArg ? ` ${j7.custom.speedArg}${sp}` : ''}\n`;
    return j7.custom.stop + '\n';
  }
  return '';
}

/* สำหรับ backward compatibility เผื่อไฟล์อื่นยังเรียกชื่อเก่า */
export const buildJ7 = buildJ7ByProfile;
