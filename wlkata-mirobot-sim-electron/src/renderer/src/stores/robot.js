import { defineStore } from 'pinia'
export const useRobotStore = defineStore('robot', {
  state: () => ({ joints: [0, 0, 0, 0, 0, 0, 0], gripper: false }),
  actions: {
    updateJoints(next) { const n = Array.isArray(next) ? next.slice(0, 7) : []; while (n.length < 7) n.push(0); this.joints = n },
    setJoint(i, val) { const j = [...this.joints]; j[i] = Number(val || 0); this.joints = j },
    setGripper(on) { this.gripper = !!on },
  }
})
