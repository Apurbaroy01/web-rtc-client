import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import DoctorPatientCall from './Components/DoctorPatientCall'


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DoctorPatientCall></DoctorPatientCall>
  </StrictMode>,
)
