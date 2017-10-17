import slides from './slides'
import selectedDrawerTab from './selectedDrawerTab'
let store = {
  slides: [],
  selectedSlide: null,
  objects: [],
  selectedDrawerTab: null
}
const getState = () => store
const setState = x => {
  console.log('STORE CHANGED')
  console.log('Prev:', store)
  console.log('Next:', x)
  store = x
}
slides({ getState, setState })
selectedDrawerTab({ getState, setState })
export default getState
