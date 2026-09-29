import React,{useState} from 'react'; import {createRoot} from 'react-dom/client'; import Login from './pages/Login'; import Dashboard from './pages/Dashboard'; import './styles.css';
function App(){const [logged,setLogged]=useState(!!localStorage.getItem('token'));return logged?<Dashboard/>:<Login onLogin={()=>setLogged(true)}/>}; createRoot(document.getElementById('root')).render(<App/>);
