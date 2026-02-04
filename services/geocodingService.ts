
import { GoogleGenAI } from "@google/genai";
import { LatLng } from "../types";
import { MOCK_CLIENTS, ClientRecord } from "../mockData";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface SuggestionItem {
  label: string;
  value: string;
  type: 'address' | 'client';
}

/**
 * Consulta o ViaCEP para obter um endereço legível a partir de um CEP.
 */
async function getAddressFromCep(cep: string): Promise<string | null> {
  const cleanCep = cep.replace(/\D/g, '');
  if (cleanCep.length !== 8) return null;

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.erro) return null;
    return `${data.logradouro}, ${data.localidade}, ${data.uf}, Brasil`;
  } catch (error) {
    console.error("ViaCEP error:", error);
    return null;
  }
}

/**
 * Fornece sugestões híbridas (Clientes + Endereços Globais).
 */
export async function getHybridSuggestions(query: string): Promise<SuggestionItem[]> {
  const trimmedQuery = query?.trim().toLowerCase() || "";
  if (trimmedQuery.length < 2) return [];

  // 1. Busca na base de clientes local
  const clientMatches: SuggestionItem[] = MOCK_CLIENTS
    .filter(c => c.name.toLowerCase().includes(trimmedQuery) || c.address.toLowerCase().includes(trimmedQuery))
    .slice(0, 3)
    .map(c => ({
      label: `${c.name} - ${c.address}`,
      value: c.address,
      type: 'client'
    }));

  // 2. Busca na API Photon
  let addressMatches: SuggestionItem[] = [];
  if (trimmedQuery.length >= 3 && /[a-zA-Z0-9]/.test(trimmedQuery)) {
    try {
      const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmedQuery)}&limit=5&lang=pt`;
      const response = await fetch(url); 
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.features)) {
          addressMatches = data.features.map((f: any) => {
            const p = f.properties;
            const parts = [p.name !== p.street ? p.name : null, p.street, p.housenumber, p.district, p.city, p.state]
              .filter(part => part !== undefined && part !== null && String(part).trim() !== "");
            return {
              label: parts.join(", "),
              value: parts.join(", "),
              type: 'address' as const
            };
          }).filter(s => s.label.length > 5);
        }
      }
    } catch (error) {
      console.error("Suggestion error:", error);
    }
  }

  return [...clientMatches, ...addressMatches];
}

async function callNominatim(query: string): Promise<{ address: string; coordinates: LatLng } | null> {
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=br`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        address: data[0].display_name,
        coordinates: [parseFloat(data[0].lat), parseFloat(data[0].lon)]
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function geocodeAddress(query: string): Promise<{ address: string; coordinates: LatLng } | null> {
  const isCep = /^\d{5}-?\d{3}$/.test(query.trim());
  if (isCep) {
    const addressFromCep = await getAddressFromCep(query);
    if (addressFromCep) {
      const result = await callNominatim(addressFromCep);
      if (result) return result;
    }
  }
  return await callNominatim(query);
}

export async function parseQueryWithGemini(query: string): Promise<string> {
  if (!query || query.trim().length === 0) return query;
  if (/^\d{5}-?\d{3}$/.test(query.trim())) return query;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Você é um especialista em logística brasileira. Transforme esta consulta de endereço, local ou nome de cliente em uma string de busca otimizada para o motor Nominatim (OSM). 
      Exemplo: "Rua do centro em SP perto da sé" -> "Praça da Sé, São Paulo, SP".
      Consulta: "${query}". 
      Retorne APENAS a string otimizada, sem explicações.`,
    });
    return response.text?.trim() || query;
  } catch (e) {
    return query;
  }
}
