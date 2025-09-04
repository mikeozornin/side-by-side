/// <reference types="@figma/plugin-typings" />

declare const __html__: string

interface VotingData {
  title: string
  duration: number
  image1: string
  image2: string
  serverUrl?: string
}

interface CreateVotingResponse {
  voting: {
    id: string
    title: string
    end_at: string
    duration_hours: number
  }
}

interface ErrorResponse {
  error: string
}
