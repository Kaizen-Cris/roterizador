
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-geoman';
import { Search, MapPin, Navigation, Calendar, Loader2, Info, User, Lock, Unlock, XCircle, Settings, Clipboard, CheckCircle2, Layers, UserCheck } from 'lucide-react';
import { DELIVERY_ZONES as INITIAL_ZONES, CENTER_COORDS } from './constants';
import { DeliveryDay, SearchResult, LatLng, DeliveryZone, PolygonPoint, DeliveryMatch } from './types';
import { isPointInPolygon } from './utils/geoUtils';
import { geocodeAddress, parseQueryWithGemini, getHybridSuggestions, SuggestionItem } from './services/geocodingService';

// Fix for default Leaflet markers
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ChangeView: React.FC<{ center: LatLng }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 14);
  }, [center, map]);
  return null;
};

const GeomanControls: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    // @ts-ignore
    const pm = (map as any).pm;
    if (!pm) return;
    pm.setLang('pt_br');
    if (enabled) {
      pm.addControls({
        position: 'topright',
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawRectangle: false,
        drawCircle: false,
        drawText: false,
        cutPolygon: true,
        editMode: true,
        dragMode: true,
        removalMode: true,
      });
    } else {
      pm.removeControls();
    }
    return () => { pm.removeControls(); };
  }, [map, enabled]);
  return null;
};

const App: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [mapCenter, setMapCenter] = useState<LatLng>(CENTER_COORDS);
  const [error, setError] = useState<string | null>(null);
  const [zones, setZones] = useState<DeliveryZone[]>(INITIAL_ZONES);

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Admin State
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      const res = await getHybridSuggestions(searchQuery);
      setSuggestions(res);
      setShowSuggestions(res.length > 0);
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  const updateZonePolygon = useCallback((zoneId: string, newPolygon: PolygonPoint[]) => {
    setZones(prev => prev.map(z => z.id === zoneId ? { ...z, polygon: newPolygon } : z));
  }, []);

  const findMatchingZones = (point: LatLng): DeliveryMatch[] => {
    const matches: DeliveryMatch[] = [];
    const activeZones = zones.filter(z => z.id !== 'remote');
    for (const zone of activeZones) {
      if (isPointInPolygon(point, zone.polygon)) {
        matches.push({ day: zone.name, zoneId: zone.id, driverName: "Mototurbo", color: zone.color });
      }
    }
    if (matches.length === 0) {
      const remoteZone = zones.find(z => z.id === 'remote');
      if (remoteZone && isPointInPolygon(point, remoteZone.polygon)) {
        matches.push({ day: DeliveryDay.REMOTE, zoneId: 'remote', driverName: "José Roberto", color: remoteZone.color });
      }
    }
    return matches;
  };

  const performSearch = async (queryValue: string, displayLabel?: string) => {
    setSearchQuery(displayLabel || queryValue);
    setShowSuggestions(false);
    setLoading(true);
    setError(null);

    try {
      const cleanQuery = queryValue.includes(",") ? queryValue : await parseQueryWithGemini(queryValue);
      const geo = await geocodeAddress(cleanQuery);

      if (geo) {
        const matches = findMatchingZones(geo.coordinates);
        setResult({
          address: geo.address,
          coordinates: geo.coordinates,
          matches: matches
        });
        setMapCenter(geo.coordinates);
      } else {
        setError("Localização não encontrada.");
      }
    } catch (err) {
      setError("Erro ao processar consulta.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;
    performSearch(searchQuery);
  };

  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === 'Sapporo1245') {
      setIsAdmin(true);
      setShowAuthModal(false);
      setPasswordInput('');
    } else {
      setAuthError(true);
      setTimeout(() => setAuthError(false), 2000);
    }
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {showAuthModal && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-sm shadow-2xl animate-in zoom-in-95">
            <h2 className="text-xl font-black text-center mb-4">Acesso Admin</h2>
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Senha..." className={`w-full p-4 bg-slate-50 border ${authError ? 'border-red-500' : 'border-slate-200'} rounded-2xl outline-none text-center font-bold`} />
              <button type="submit" className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-black">Entrar</button>
            </form>
          </div>
        </div>
      )}

      <aside className="w-full md:w-[380px] bg-white border-r border-slate-200 flex flex-col shadow-2xl z-20 shrink-0">
        <header className="p-8 border-b bg-slate-900 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Navigation className="w-6 h-6 text-indigo-400" />
            <h1 className="text-xl font-black italic">ROTA<span className="text-indigo-400 font-normal">EXPRESS</span></h1>
          </div>
          <p className="text-slate-400 text-[10px] uppercase font-bold tracking-widest">Base de Clientes & Logística</p>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section className="relative" ref={suggestionRef}>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Busca Inteligente (Cliente/Endereço)</label>
            <form onSubmit={handleSearch} className="relative group">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Nome, CEP ou Endereço..."
                className="w-full pl-11 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none text-sm"
              />
              <Search className="absolute left-4 top-4.5 w-5 h-5 text-slate-400" />
              <button disabled={loading} className="absolute right-2 top-2 p-2.5 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-200">
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Navigation className="w-5 h-5" />}
              </button>
            </form>

            {showSuggestions && (
              <div className="absolute w-full mt-2 bg-white/95 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                {suggestions.map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => performSearch(sug.value, sug.label)}
                    className="w-full px-4 py-3 text-left text-xs hover:bg-indigo-50 flex items-start gap-3 border-b border-slate-50 last:border-0 group"
                  >
                    {sug.type === 'client' ? (
                      <UserCheck className="w-4 h-4 mt-0.5 text-green-600 shrink-0" />
                    ) : (
                      <MapPin className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                    )}
                    <div className="flex flex-col">
                      <span className={`font-bold ${sug.type === 'client' ? 'text-indigo-900' : 'text-slate-700'}`}>{sug.label.split(' - ')[0]}</span>
                      {sug.label.includes(' - ') && (
                        <span className="text-[10px] text-slate-500 mt-0.5">{sug.label.split(' - ')[1]}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            {error && <p className="mt-3 text-red-500 text-xs font-semibold bg-red-50 p-2 rounded-lg border border-red-100">{error}</p>}
          </section>

          {isAdmin && (
            <section className="p-5 bg-amber-50 rounded-3xl border-2 border-amber-200">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-amber-600" />
                    <h4 className="text-[10px] font-black uppercase text-amber-700">Edição Ativa</h4>
                  </div>
                  <button onClick={() => setIsAdmin(false)} className="text-[9px] font-black uppercase text-amber-600 underline">Fechar</button>
               </div>
               <button onClick={() => {
                 navigator.clipboard.writeText(JSON.stringify(zones));
                 setCopyFeedback(true);
                 setTimeout(() => setCopyFeedback(false), 2000);
               }} className="w-full py-3 bg-white border border-amber-200 rounded-xl text-[10px] font-black uppercase text-amber-700 hover:bg-amber-100 flex items-center justify-center gap-2">
                 {copyFeedback ? <CheckCircle2 className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
                 {copyFeedback ? 'Copiado!' : 'Exportar Zonas'}
               </button>
            </section>
          )}

          {result ? (
            <section className="animate-in fade-in slide-in-from-bottom-4">
              <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="p-2 bg-white/20 rounded-xl"><Layers className="w-5 h-5" /></div>
                    {result.matches.length > 1 && <span className="text-[8px] font-black uppercase bg-amber-500 px-2 py-1 rounded-full">Multi-Zonas</span>}
                  </div>
                  <div className="space-y-3">
                    {result.matches.length > 0 ? result.matches.map((match, idx) => (
                      <div key={idx} className="bg-white/10 p-4 rounded-2xl border border-white/5 backdrop-blur-sm">
                        <h3 className="text-indigo-200 text-[9px] font-bold uppercase tracking-widest mb-1">Dia de Entrega</h3>
                        <p className="text-xl font-black">{match.day}</p>
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                          <User className="w-3 h-3" />
                          <span className="text-xs font-bold">{match.driverName}</span>
                          <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: match.color }} />
                        </div>
                      </div>
                    )) : (
                      <div className="bg-red-500/20 p-4 rounded-2xl text-center border border-red-500/30">
                        <XCircle className="w-8 h-8 mx-auto mb-2 text-red-200" />
                        <p className="text-xs font-black uppercase">Fora de Cobertura</p>
                      </div>
                    )}
                  </div>
                  <div className="pt-4 border-t border-white/10 flex items-start gap-2">
                    <MapPin className="w-3 h-3 mt-1 shrink-0 opacity-60" />
                    <p className="text-[10px] leading-relaxed opacity-80">{result.address}</p>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-8 text-center space-y-2 opacity-50">
               <Info className="w-6 h-6 text-slate-300 mx-auto" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-loose">Aguardando consulta<br/>de cliente ou endereço</p>
            </div>
          )}

          <section>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Áreas de Atendimento</label>
            <div className="space-y-3">
              {zones.map(zone => (
                <div key={zone.id} className="flex items-center justify-between text-[11px] font-bold">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: zone.color }} />
                    <span className="text-slate-600">{zone.name}</span>
                  </div>
                  <span className="text-slate-300 font-black uppercase text-[8px]">{zone.id === 'remote' ? 'José Roberto' : 'Equipe Mototurbo'}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </aside>

      <main className="flex-1 relative">
        <MapContainer center={mapCenter} zoom={13} className="h-full w-full" zoomControl={false}>
          <TileLayer attribution='&copy; Google Maps' url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" />
          <ChangeView center={mapCenter} />
          <GeomanControls enabled={isAdmin} />
          {zones.map(zone => (
            <Polygon
              key={zone.id}
              positions={zone.polygon}
              eventHandlers={{
                'pm:update': (e: any) => {
                  const newPolygon = e.layer.getLatLngs()[0].map((ll: any) => ({ lat: ll.lat, lng: ll.lng }));
                  updateZonePolygon(zone.id, newPolygon);
                }
              } as any}
              pathOptions={{ fillColor: zone.color, fillOpacity: 0.15, color: zone.color, weight: 2 }}
            >
              <Popup className="custom-popup">
                <p className="font-bold text-slate-800 m-0">{zone.name}</p>
                <p className="text-[10px] text-slate-500 m-0">Resp: {zone.id === 'remote' ? 'José Roberto' : 'Mototurbo'}</p>
              </Popup>
            </Polygon>
          ))}
          {result && (
            <Marker position={result.coordinates}>
              <Popup>
                <div className="p-1 min-w-[120px]">
                  <h4 className="font-black text-indigo-600 text-[9px] uppercase border-b mb-1 pb-1">Destino Localizado</h4>
                  {result.matches.length > 0 ? result.matches.map((m, i) => (
                    <div key={i} className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color }} />
                      {m.day}
                    </div>
                  )) : <span className="text-[10px] text-red-500 font-bold">Sem atendimento</span>}
                </div>
              </Popup>
            </Marker>
          )}
        </MapContainer>
        <div className="absolute top-6 left-6 z-[1000]">
           <button onClick={() => isAdmin ? setIsAdmin(false) : setShowAuthModal(true)} className={`p-4 rounded-2xl shadow-xl backdrop-blur-md border flex items-center gap-3 transition-all ${isAdmin ? 'bg-amber-600 text-white border-amber-500' : 'bg-white/90 text-slate-900 border-white/50'}`}>
              {isAdmin ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
              <span className="text-[10px] font-black uppercase tracking-widest">{isAdmin ? 'Edição Liberada' : 'Gestão Logística'}</span>
           </button>
        </div>
      </main>
    </div>
  );
};

export default App;
