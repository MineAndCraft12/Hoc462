import { button } from './Button.css'
import Renamable from './Renamable'
import styles from './Object.css'
export default () => {
  const root = document.createElement('div')
  root.classList.add(styles.object)
  root.innerHTML = `
    <div class="name"></div>
    <div class="actions">
      <button class="${button} delete">Delete</button>
      <button class="${button} clone">Clone</button>
      <button class="${button} rename">Rename</button>
      <button class="${button} texture-upload-button">Set texture</button>
      <input type="file" class="texture-upload-input">
      <input type="color" class="color-picker">
    </div>
    <div class="properties">
      ${
        ['Position', 'Rotation', 'Scale'].map(property => `
          <div class="${property.toLowerCase()}">
            <label>${property}: </label>
            ${'<input type="number" step="0.01"> '.repeat(3)}
          </div>
        `).join('')
      }
    </div>
  `
  let newlyCreated = true
  let isRenaming = false
  const nameEl = root.querySelector('.name')
  const renamable = Renamable()
  renamable.classList.add('name')
  nameEl.parentNode.replaceChild(renamable, nameEl)
  const deleteButton = root.querySelector('.delete')
  const renameButton = root.querySelector('.rename')
  const cloneButton = root.querySelector('.clone')
  const colorPicker = root.querySelector('.color-picker')
  const textureUploadButton = root.querySelector('.texture-upload-button')
  const textureUploadInput = root.querySelector('.texture-upload-input')
  const actionButtons = [
    deleteButton,
    renameButton,
    cloneButton,
    colorPicker,
    textureUploadButton,
    textureUploadInput
  ]
  const actionsElement = root.querySelector('.actions')
  deleteButton.addEventListener('click', () => {
    root.dispatchEvent(new window.Event('deleted'))
  })
  colorPicker.addEventListener('change', () => {
    root.dispatchEvent(new window.CustomEvent('color-changed', {
      detail: { color: colorPicker.value }
    }))
  })
  cloneButton.addEventListener('click', () => {
    root.dispatchEvent(new window.Event('cloned'))
  })
  textureUploadButton.addEventListener('click', () => {
    textureUploadInput.click()
  })
  textureUploadInput.addEventListener('change', () => {
    root.dispatchEvent(new window.CustomEvent('texture-changed', {
      detail: {
        blobUrl: window.URL.createObjectURL(textureUploadInput.files[0])
      }
    }))
  })
  root.addEventListener('click', ({ target }) => {
    if (!actionButtons.includes(target)) {
      root.dispatchEvent(new window.Event('selected'))
    }
  })
  const startRenaming = () => {
    isRenaming = true
    if (newlyCreated) {
      const renameCanceledHandler = () => {
        renamable.removeEventListener('rename-canceled', renameCanceledHandler)
        root.dispatchEvent(new window.Event('deleted'))
      }
      renamable.addEventListener('rename-canceled', renameCanceledHandler)
    }
    renamable.dispatchEvent(new window.Event('start-renaming'))
    actionsElement.style.display = 'none'
  }
  renameButton.addEventListener('click', startRenaming)
  root.addEventListener('start-renaming', startRenaming)
  root.addEventListener('highlighted', () => {
    root.classList.add('highlighted')
  })
  root.addEventListener('unhighlighted', () => {
    root.classList.remove('highlighted')
  })
  root.addEventListener('color-changed', ({ detail: { color } }) => {
    colorPicker.value = color
  })
  root.addEventListener('deleted', () => { root.remove() })
  renamable.addEventListener('renamed', ({ detail: { name } }) => {
    if (isRenaming) {
      isRenaming = false
      if (newlyCreated) {
        newlyCreated = false
      }
      root.dispatchEvent(new window.CustomEvent('name-changed', {
        detail: { name }
      }))
      actionsElement.style.display = ''
    }
    // otherwise, renamable's name is being set by name-changed handler.
    // this event handler will do nothing.
  })
  const positionElement = root.querySelector('.position')
  const rotationElement = root.querySelector('.rotation')
  const scaleElement = root.querySelector('.scale')
  const objectProperties = { position: [], rotation: [], scale: [] }
  // prevent camera from moving if user presses arrow keys
  // while editing an input
  ;[positionElement, rotationElement, scaleElement]
    .map(element => element.querySelectorAll('input'))
    .reduce((accumulator, element) => accumulator.concat([...element]), [])
    .forEach(input => input.addEventListener(
      'keydown', event => event.stopPropagation()
    ))
  ;[...positionElement.querySelectorAll('input')].forEach((input, index) => {
    input.addEventListener('input', () => {
      if(input.value !== '-' && input.value !== ''){
        const newPosition = [...objectProperties.position]
        newPosition[index] = +input.value
        root.dispatchEvent(new window.CustomEvent('position-changed', {
          detail: { position: newPosition }
        }))
      }
    })
  })
  root.addEventListener('position-changed', ({ detail: { position } }) => {
    objectProperties.position = position
    ;[...positionElement.querySelectorAll('input')].forEach((input, index) => {
      input.value = position[index]
    })
  })
  ;[...rotationElement.querySelectorAll('input')].forEach((input, index) => {
    input.addEventListener('input', () => {
      if(input.value !== '-' && input.value !== ''){
        const newRotation = [...objectProperties.rotation]
        newRotation[index] = +input.value / 180 * Math.PI
        root.dispatchEvent(new window.CustomEvent('rotation-changed', {
          detail: { rotation: newRotation }
        }))
      }
    })
  })
  root.addEventListener('rotation-changed', ({ detail: { rotation } }) => {
    objectProperties.rotation = rotation
    ;[...rotationElement.querySelectorAll('input')].forEach((input, index) => {
      input.value = rotation[index] / Math.PI * 180
    })
  })
  ;[...scaleElement.querySelectorAll('input')].forEach((input, index) => {
    input.addEventListener('input', () => {
      if(input.value !== '-' && input.value !== ''){
        const newScale = [...objectProperties.scale]
        newScale[index] = +input.value
        root.dispatchEvent(new window.CustomEvent('scale-changed', {
          detail: { scale: newScale }
        }))
      }
    })
  })
  root.addEventListener('scale-changed', ({ detail: { scale } }) => {
    objectProperties.scale = scale
    ;[...scaleElement.querySelectorAll('input')].forEach((input, index) => {
      input.value = scale[index]
    })
  })
  root.addEventListener('name-changed', ({ detail: { name } }) => {
    renamable.dispatchEvent(
      new window.CustomEvent('renamed', { detail: { name } })
    )
  })
  return root
}
