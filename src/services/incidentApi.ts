import type { Incident } from '../types/incident'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export async function fetchIncidents(): Promise<Incident[]> {
  const response = await fetch(`${API_BASE_URL}/api/incidents`)
  if (!response.ok) {
    throw new Error('Failed to fetch incidents')
  }
  const data = await response.json()
  return data.incidents ?? []
}

export async function fetchIncidentById(id: string): Promise<Incident> {
  const response = await fetch(`${API_BASE_URL}/api/incidents/${id}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch incident ${id}`)
  }
  return response.json()
}

export async function assessIncident(id: string): Promise<Incident> {
  const response = await fetch(`${API_BASE_URL}/api/incidents/${id}/assess`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`Failed to run assessment for incident ${id}`)
  }
  return response.json()
}
