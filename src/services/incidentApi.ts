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

export const assessIncident = async (id: string): Promise<Incident> => {
  const response = await fetch(`${API_BASE_URL}/api/incidents/${id}/assess`, {
    method: 'POST',
  })
  if (!response.ok) {
    throw new Error(`Failed to run assessment for incident ${id}`)
  }
  return response.json()
}

export const getSpatialArtifactUrl = (id: string, artifactName: string): string => {
  return `${API_BASE_URL}/api/incidents/${id}/assessment/spatial/${artifactName}`
}

export const getIncidentImageryUrl = (id: string, type: 'before' | 'after'): string => {
  return `${API_BASE_URL}/api/incidents/${id}/imagery/${type}`
}

export const verifyIncident = async (id: string, payload: { decision: string; notes?: string; reviewer_name: string }): Promise<Incident> => {
  const response = await fetch(`${API_BASE_URL}/api/incidents/${id}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to verify incident ${id}`)
  }
  return response.json()
}

export const calculateIncidentPriority = async (id: string): Promise<Incident> => {
  const response = await fetch(`${API_BASE_URL}/api/incidents/${id}/priority`, {
    method: 'POST',
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to calculate priority for incident ${id}`)
  }
  return response.json()
}

export const generateResponsePlan = async (id: string): Promise<Incident> => {
  const response = await fetch(`${API_BASE_URL}/api/incidents/${id}/response-plan`, {
    method: 'POST',
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to generate response plan for incident ${id}`)
  }
  return response.json()
}

export const approveResponsePlan = async (id: string, payload: { approver_name: string }): Promise<Incident> => {
  const response = await fetch(`${API_BASE_URL}/api/incidents/${id}/response-plan/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.detail || `Failed to approve response plan for incident ${id}`)
  }
  return response.json()
}
