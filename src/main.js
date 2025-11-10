import Alpine from 'alpinejs'
import './style.css'

// Alpine store for Buses panel (lightweight templating)
// Exposes arrays and simple filtering bound to x-model inputs.
export function busesStore() {
  return {
    modelQuery: '',
    busQuery: '',
    modelPage: 1,
    busPage: 1,
    itemsPerPage: 2,
    models: [
      { id: 1, name: 'Model A', manufacturer: 'Test 01', description: 'Lorem ipsum ...' },
      { id: 2, name: 'Model B', manufacturer: 'Test 02', description: 'Lorem ipsum ...' },
      { id: 3, name: 'Model C', manufacturer: 'Test 03', description: 'Lorem ipsum ...' },
      { id: 4, name: 'Model D', manufacturer: 'Test 04', description: 'Lorem ipsum ...' },
      { id: 5, name: 'Model E', manufacturer: 'Test 05', description: 'Lorem ipsum ...' },
      { id: 6, name: 'Model F', manufacturer: 'Test 06', description: 'Lorem ipsum ...' },
    ],
    buses: [
      { id: 1, name: 'Bus 101', model: 'Model A', description: 'Lorem ipsum ...' },
      { id: 2, name: 'Bus 102', model: 'Model B', description: 'Lorem ipsum ...' },
      { id: 3, name: 'Bus 103', model: 'Model C', description: 'Lorem ipsum ...' },
      { id: 4, name: 'Bus 104', model: 'Model D', description: 'Lorem ipsum ...' },
      { id: 5, name: 'Bus 105', model: 'Model E', description: 'Lorem ipsum ...' },
      { id: 6, name: 'Bus 106', model: 'Model F', description: 'Lorem ipsum ...' },
      { id: 7, name: 'Bus 201', model: 'Model A', description: 'Lorem ipsum ...' },
      { id: 8, name: 'Bus 202', model: 'Model B', description: 'Lorem ipsum ...' },
      { id: 9, name: 'Bus 203', model: 'Model C', description: 'Lorem ipsum ...' },
      { id: 10, name: 'Bus 204', model: 'Model D', description: 'Lorem ipsum ...' },
      { id: 11, name: 'Bus 205', model: 'Model E', description: 'Lorem ipsum ...' },
      { id: 12, name: 'Bus 206', model: 'Model F', description: 'Lorem ipsum ...' },
    ],
    get allFilteredModels() {
      const q = this.modelQuery.trim().toLowerCase()
      if (!q) return this.models
      return this.models.filter((m) =>
        [m.name, m.manufacturer, m.description].some((v) =>
          String(v).toLowerCase().includes(q)
        )
      )
    },
    get filteredModels() {
      const all = this.allFilteredModels
      const start = (this.modelPage - 1) * this.itemsPerPage
      const end = start + this.itemsPerPage
      return all.slice(start, end)
    },
    get modelTotalPages() {
      return Math.ceil(this.allFilteredModels.length / this.itemsPerPage)
    },
    get allFilteredBuses() {
      const q = this.busQuery.trim().toLowerCase()
      if (!q) return this.buses
      return this.buses.filter((b) =>
        [b.name, b.model, b.description].some((v) =>
          String(v).toLowerCase().includes(q)
        )
      )
    },
    get filteredBuses() {
      const all = this.allFilteredBuses
      const start = (this.busPage - 1) * this.itemsPerPage
      const end = start + this.itemsPerPage
      return all.slice(start, end)
    },
    get busTotalPages() {
      return Math.ceil(this.allFilteredBuses.length / this.itemsPerPage)
    },
    setModelPage(page) {
      if (page >= 1 && page <= this.modelTotalPages) {
        this.modelPage = page
      }
    },
    setBusPage(page) {
      if (page >= 1 && page <= this.busTotalPages) {
        this.busPage = page
      }
    },
  }
}

// Alpine store for Custom Stops panel
export function customStopsStore() {
  return {
    query: '',
    currentPage: 1,
    itemsPerPage: 2,
    stops: [
      { id: 1, name: 'Test 01', type: 'Depot', address: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi' },
      { id: 2, name: 'Test 02', type: 'Depot', address: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi' },
      { id: 3, name: 'Test 03', type: 'Bus stop', address: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi' },
      { id: 4, name: 'Test 04', type: 'Bus stop', address: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi' },
      { id: 5, name: 'Test 05', type: 'Bus stop', address: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi' },
      { id: 6, name: 'Test 06', type: 'Bus stop', address: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Morbi' },
    ],
    get allFilteredStops() {
      const q = this.query.trim().toLowerCase()
      if (!q) return this.stops
      return this.stops.filter((s) =>
        [s.name, s.type, s.address].some((v) =>
          String(v).toLowerCase().includes(q)
        )
      )
    },
    get filteredStops() {
      const all = this.allFilteredStops
      const start = (this.currentPage - 1) * this.itemsPerPage
      const end = start + this.itemsPerPage
      return all.slice(start, end)
    },
    get totalPages() {
      return Math.ceil(this.allFilteredStops.length / this.itemsPerPage)
    },
    setPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page
      }
    },
  }
}

// Alpine store for Shifts panel
export function shiftsStore() {
  return {
    query: '',
    currentPage: 1,
    itemsPerPage: 2,
    shifts: [
      { id: 1, shiftName: '0000000', busName: 'Test 01', startingTime: '00:00', endingTime: '00:00', route: 'Point A - Point B' },
      { id: 2, shiftName: '0000000', busName: 'Test 02', startingTime: '00:00', endingTime: '00:00', route: 'Point A - Point B' },
      { id: 3, shiftName: '0000000', busName: 'Test 03', startingTime: '00:00', endingTime: '00:00', route: 'Point A - Point B' },
      { id: 4, shiftName: '0000000', busName: 'Test 04', startingTime: '00:00', endingTime: '00:00', route: 'Point A - Point B' },
      { id: 5, shiftName: '0000000', busName: 'Test 05', startingTime: '00:00', endingTime: '00:00', route: 'Point A - Point B' },
      { id: 6, shiftName: '0000000', busName: 'Test 06', startingTime: '00:00', endingTime: '00:00', route: 'Point A - Point B' },
    ],
    get allFilteredShifts() {
      const q = this.query.trim().toLowerCase()
      if (!q) return this.shifts
      return this.shifts.filter((s) =>
        [s.shiftName, s.busName, s.startingTime, s.endingTime, s.route].some((v) =>
          String(v).toLowerCase().includes(q)
        )
      )
    },
    get filteredShifts() {
      const all = this.allFilteredShifts
      const start = (this.currentPage - 1) * this.itemsPerPage
      const end = start + this.itemsPerPage
      return all.slice(start, end)
    },
    get totalPages() {
      return Math.ceil(this.allFilteredShifts.length / this.itemsPerPage)
    },
    setPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page
      }
    },
  }
}

window.Alpine = Alpine
Alpine.data('buses', busesStore)
Alpine.data('customStops', customStopsStore)
Alpine.data('shifts', shiftsStore)
Alpine.start()

