// Double SDK: menguji kontrak/interaksi komponen, bukan rendering Google nyata.
(() => {
  const state = window.__mapsTest = { maps: [], markers: [], imports: [] };
  const listen = (obj, name, callback) => {
    (obj.listeners[name] ||= new Set()).add(callback);
    return { remove: () => obj.listeners[name]?.delete(callback) };
  };
  const emit = (obj, name, value) => [...(obj.listeners[name] || [])].forEach((fn) => fn(value));
  class MockMap {
    constructor(element, options) { this.element = element; this.options = options; this.zoom = options.zoom; this.listeners = {}; state.maps.push(this); }
    addListener(name, fn) { return listen(this, name, fn); }
    getBounds() { return { contains: () => true }; }
    getZoom() { return this.zoom; }
    setZoom(zoom) { this.zoom = zoom; emit(this, 'idle'); }
    setCenter(position) { this.center = position; }
    fitBounds(bounds) { this.bounds = bounds; this.zoom = 10; setTimeout(() => emit(this, 'idle'), 0); }
  }
  class Marker {
    constructor(options) {
      this.options = options; this.position = options.position; this.listeners = {};
      this.element = document.createElement('button'); this.element.title = options.title;
      this.element.className = 'test-marker'; this.element.onclick = () => emit(this, 'click');
      this.map = options.map; state.markers.push(this);
    }
    set map(map) { this.currentMap = map; if (map) map.element.append(this.element); else this.element.remove(); }
    get map() { return this.currentMap; }
    append(element) { this.element.append(element); }
    addListener(name, fn) { return listen(this, name, fn); }
  }
  class Bounds { constructor() { this.points = []; } extend(p) { this.points.push(p); } }
  window.__emitMapEvent = emit;
  window.google = { maps: {
    importLibrary: async (name) => { state.imports.push(name); return name === 'maps' ? { Map: MockMap } : { AdvancedMarkerElement: Marker }; },
    LatLngBounds: Bounds,
    event: {
      clearInstanceListeners: (obj) => { obj.listeners = {}; },
      addListenerOnce: (obj, name, fn) => { const listener = listen(obj, name, (...args) => { listener.remove(); fn(...args); }); return listener; }
    }
  } };
  const callback = new URL(document.currentScript.src).searchParams.get('callback');
  window[callback]();
})();
