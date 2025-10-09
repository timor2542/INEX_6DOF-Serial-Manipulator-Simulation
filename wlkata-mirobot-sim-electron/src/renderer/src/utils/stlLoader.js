export function fitCameraToObject(camera, object3D, controls, offset = 1.2) {
    const box = new (camera.constructor.name === 'OrthographicCamera' ? THREE.Box3 : THREE.Box3)()
    box.setFromObject(object3D)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = camera.fov * (Math.PI / 180)
    let camZ = Math.abs(maxDim / (2 * Math.tan(fov / 2)))
    camZ *= offset

    camera.position.set(center.x + camZ * 0.6, center.y + camZ * 0.6, center.z + camZ)
    camera.near = camZ / 100
    camera.far = camZ * 100
    camera.updateProjectionMatrix()

    if (controls) {
        controls.target.copy(center)
        controls.update()
    }
}