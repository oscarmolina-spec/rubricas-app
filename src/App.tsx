import React, { useState, useEffect, useRef } from 'react';
import { db } from './firebase';
import { collection, addDoc, onSnapshot, query, deleteDoc, doc } from 'firebase/firestore';

interface Alumno {
  id: string;
  nombre: string;
}

interface Criterio {
  item: string;
  porcentaje: number;
}

interface Rubrica {
  id: string;
  nombre: string;
  criterios: Criterio[];
}

interface Evaluacion {
  id: string;
  alumno: string;
  rubricaNombre: string;
  notaFinal: number;
  fechaEvaluacion: string;
  notasDetalle: { [key: string]: number };
  comentarios?: string;
}

// 🔔 Componente Toast Premium para notificaciones elegantes
function ToastContainer({ toasts }: { toasts: { id: number; mensaje: string; tipo: string }[] }) {
  if (!toasts || toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 999999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      maxWidth: '350px',
      width: '100%',
      pointerEvents: 'none'
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '16px 20px',
          borderRadius: '16px',
          backgroundColor: t.tipo === 'exito' ? '#10b981' : t.tipo === 'error' ? '#ef4444' : t.tipo === 'advertencia' ? '#f59e0b' : '#3b82f6',
          color: 'white',
          fontWeight: 'bold',
          fontSize: '0.9rem',
          boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '15px',
          pointerEvents: 'auto',
          animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards, fadeOut 0.3s ease-in 3.2s forwards',
          borderLeft: '5px solid rgba(0,0,0,0.2)'
        }}>
          <span>{t.mensaje}</span>
        </div>
      ))}
    </div>
  );
}

// 💀 Componente de Carga Esqueleto (Skeleton Row) para tablas
function SkeletonRow() {
  return (
    <tr style={{ animation: 'pulse 1.5s infinite ease-in-out' }}>
      <td style={{ padding: '16px' }}><div style={{ height: '18px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '4px', width: '60%' }} /></td>
      <td style={{ padding: '16px' }}><div style={{ height: '18px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '4px', width: '50%' }} /></td>
      <td style={{ padding: '16px' }}><div style={{ height: '18px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '4px', width: '40%' }} /></td>
      <td style={{ padding: '16px', textAlign: 'center' }}><div style={{ height: '24px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '6px', width: '30px', margin: '0 auto' }} /></td>
    </tr>
  );
}

export default function App() {
  const [pantalla, setPantalla] = useState<'disenador' | 'evaluador' | 'historial'>('disenador');

  // --- ESTADOS ---
  const [nombreRubrica, setNombreRubrica] = useState('');
  const [criterios, setCriterios] = useState<Criterio[]>([
    { item: '', porcentaje: 0 },
  ]);
  const [listaRubricas, setListaRubricas] = useState<Rubrica[]>([]);
  const [rubricaSeleccionada, setRubricaSeleccionada] = useState<Rubrica | null>(null);
  const [nombreAlumno, setNombreAlumno] = useState('');
  const [notasEvaluacion, setNotasEvaluacion] = useState<{ [key: string]: number }>({});
  const [listaEvaluaciones, setListaEvaluaciones] = useState<Evaluacion[]>([]);
  const [listaAlumnos, setListaAlumnos] = useState<Alumno[]>([]);
  const [comentarioEvaluacion, setComentarioEvaluacion] = useState('');

  // Estados Premium
  const [toasts, setToasts] = useState<{ id: number; mensaje: string; tipo: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modoOscuro, setModoOscuro] = useState(false); // 🌓 Control del Modo Oscuro
  const [expandidoId, setExpandidoId] = useState<string | null>(null); // Fila expandida en historial

  // Estados Autocomplete Combobox
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [sugerenciasFiltradas, setSugerenciasFiltradas] = useState<Alumno[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Estado Impresión Boletín Modal
  const [boletinImprimir, setBoletinImprimir] = useState<Evaluacion | null>(null);

  // Helper para lanzar Toasts flotantes
  const lanzarToast = (mensaje: string, tipo = 'exito') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Cargar datos en tiempo real de Firestore (onSnapshot)
  useEffect(() => {
    setCargando(true);
    let unsubRubricas = () => {};
    let unsubEvaluaciones = () => {};
    let unsubAlumnos = () => {};

    // 1. Escuchar rúbricas
    const qRub = query(collection(db, 'rubricas'));
    unsubRubricas = onSnapshot(qRub, (snapshot) => {
      setListaRubricas(snapshot.docs.map(d => ({
        id: d.id,
        nombre: d.data().nombre,
        criterios: d.data().criterios || []
      })));
      if (pantalla === 'evaluador') setCargando(false);
    }, () => lanzarToast('Error al conectar con rúbricas ☁️', 'error'));

    // 2. Escuchar evaluaciones
    const qEval = query(collection(db, 'evaluaciones'));
    unsubEvaluaciones = onSnapshot(qEval, (snapshot) => {
      const e = snapshot.docs.map(d => ({
        id: d.id,
        alumno: d.data().alumno,
        rubricaNombre: d.data().rubricaNombre,
        notaFinal: d.data().notaFinal,
        fechaEvaluacion: d.data().fechaEvaluacion,
        notasDetalle: d.data().notasDetalle || {},
        comentarios: d.data().comentarios || ''
      }));
      e.sort((a, b) => new Date(b.fechaEvaluacion).getTime() - new Date(a.fechaEvaluacion).getTime());
      setListaEvaluaciones(e);
      if (pantalla === 'historial') setCargando(false);
    }, () => lanzarToast('Error al conectar con el historial ☁️', 'error'));

    // 3. Escuchar alumnos importados
    const qAlum = query(collection(db, 'alumnos'));
    unsubAlumnos = onSnapshot(qAlum, (snapshot) => {
      const a = snapshot.docs.map(d => ({
        id: d.id,
        nombre: d.data().nombre
      }));
      a.sort((x, y) => x.nombre.localeCompare(y.nombre));
      setListaAlumnos(a);
    });

    return () => {
      unsubRubricas();
      unsubEvaluaciones();
      unsubAlumnos();
    };
  }, [pantalla]);

  // Manejo de clics fuera para cerrar dropdown de autocompletado
  useEffect(() => {
    function clickFuera(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setMostrarSugerencias(false);
      }
    }
    document.addEventListener('mousedown', clickFuera);
    return () => document.removeEventListener('mousedown', clickFuera);
  }, []);

  // Plantillas de rúbricas predefinidas
  const cargarPlantillaPredefinida = (tipo: 'oral' | 'grupo' | 'mates') => {
    if (tipo === 'oral') {
      setNombreRubrica('🗣️ Exposición Oral del Proyecto');
      setCriterios([
        { item: 'Contenido y Estructura del tema', porcentaje: 30 },
        { item: 'Claridad, Entonación y Vocabulario', porcentaje: 30 },
        { item: 'Expresión Corporal y Gestualidad', porcentaje: 20 },
        { item: 'Uso de Material de Apoyo y Diapositivas', porcentaje: 20 },
      ]);
      lanzarToast('¡Cargada rúbrica de Exposición Oral! 🗣️', 'exito');
    } else if (tipo === 'grupo') {
      setNombreRubrica('👥 Trabajo Grupal y Colaboración');
      setCriterios([
        { item: 'Calidad, Profundidad y Contenido del trabajo', porcentaje: 35 },
        { item: 'Cooperación, Participación y Respeto en grupo', porcentaje: 25 },
        { item: 'Planificación, Organización y Reparto', porcentaje: 20 },
        { item: 'Entrega en los plazos y formato acordado', porcentaje: 20 },
      ]);
      lanzarToast('¡Cargada rúbrica de Trabajo Grupal! 👥', 'exito');
    } else if (tipo === 'mates') {
      setNombreRubrica('🧮 Resolución de Problemas Matemáticos');
      setCriterios([
        { item: 'Estrategia de cálculo y Operaciones correctas', porcentaje: 40 },
        { item: 'Comprensión y Análisis del Enunciado', porcentaje: 30 },
        { item: 'Justificación e Interpretación de resultados', porcentaje: 20 },
        { item: 'Limpieza, Estructura y Presentación', porcentaje: 10 },
      ]);
      lanzarToast('¡Cargada rúbrica de Resolución de Problemas! 🧮', 'exito');
    }
  };

  // Procesamiento de lista de alumnos (Drag & Drop / Input)
  const procesarArchivoAlumnos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;

      // Separar por comas, puntos y comas o nuevas líneas
      const lineas = text.split(/[\n,;]/);
      const nombresLimpios = lineas
        .map(l => l.replace(/["\r]/g, '').trim())
        .filter(l => l.length > 2 && !l.toLowerCase().includes('nombre') && !l.toLowerCase().includes('alumno'));

      const nombresUnicos = Array.from(new Set(nombresLimpios));
      if (nombresUnicos.length === 0) {
        lanzarToast('⚠️ No encontramos nombres válidos en el archivo', 'advertencia');
        return;
      }

      lanzarToast(`Importando ${nombresUnicos.length} alumnos... ⏳`, 'info');

      // Subir cada alumno a Firestore de forma asíncrona
      let subidos = 0;
      for (const nombre of nombresUnicos) {
        // Evitar duplicados contra lo que ya tenemos
        if (!listaAlumnos.some(al => al.nombre.toLowerCase() === nombre.toLowerCase())) {
          try {
            await addDoc(collection(db, 'alumnos'), {
              nombre: nombre,
              fechaRegistro: new Date().toISOString()
            });
            subidos++;
          } catch (err) {
            console.error(err);
          }
        }
      }

      lanzarToast(`¡Importación completada! ${subidos} alumnos nuevos añadidos. 📁🎉`, 'exito');
      e.target.value = ''; // Reset input
    };
    reader.readAsText(file);
  };

  // Limpiar listado de alumnos de Firestore
  const vaciarListaAlumnos = async () => {
    if (!window.confirm('¿Estás seguro de que quieres borrar TODOS los alumnos del listado importado?')) return;
    lanzarToast('Eliminando listado... 🗑️', 'info');
    try {
      for (const al of listaAlumnos) {
        await deleteDoc(doc(db, 'alumnos', al.id));
      }
      lanzarToast('¡Listado de alumnos vaciado por completo!', 'exito');
    } catch (err) {
      lanzarToast('Error al vaciar listado', 'error');
    }
  };

  // Funciones del Diseñador
  const handleAñadirCriterio = () => {
    setCriterios([...criterios, { item: '', porcentaje: 0 }]);
  };

  const handleCambioCriterio = (index: number, campo: keyof Criterio, valor: string | number) => {
    const nuevosCriterios = [...criterios];
    if (campo === 'porcentaje') {
      nuevosCriterios[index][campo] = Number(valor);
    } else {
      nuevosCriterios[index][campo] = valor as string;
    }
    setCriterios(nuevosCriterios);
  };

  const handleEliminarCriterio = (index: number) => {
    if (criterios.length === 1) {
      lanzarToast('¡Debes mantener al menos un criterio! 📝', 'advertencia');
      return;
    }
    setCriterios(criterios.filter((_, i) => i !== index));
  };

  const handleGuardarRubrica = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreRubrica.trim()) {
      lanzarToast('¡Escribe el nombre de la rúbrica! 📝', 'advertencia');
      return;
    }
    const totalPorcentaje = criterios.reduce((acc, curr) => acc + curr.porcentaje, 0);
    if (totalPorcentaje !== 100) {
      lanzarToast(`El porcentaje total debe ser 100%. Actualmente es ${totalPorcentaje}% ⚠️`, 'advertencia');
      return;
    }
    try {
      await addDoc(collection(db, 'rubricas'), {
        nombre: nombreRubrica,
        criterios: criterios,
        fechaCreacion: new Date().toISOString(),
      });
      lanzarToast('¡Rúbrica guardada con éxito en la nube! ☁️✨', 'exito');
      setNombreRubrica('');
      setCriterios([{ item: '', porcentaje: 0 }]);
    } catch (error) {
      console.error(error);
      lanzarToast('Hubo un error al guardar la rúbrica ❌', 'error');
    }
  };

  // Funciones del Evaluador
  const handleSeleccionarRubrica = (id: string) => {
    const encontrada = listaRubricas.find((r) => r.id === id);
    if (encontrada) {
      setRubricaSeleccionada(encontrada);
      const notasIniciales: { [key: string]: number } = {};
      encontrada.criterios.forEach((c) => {
        notasIniciales[c.item] = 5.0; // Comenzar en una nota media de 5.0
      });
      setNotasEvaluacion(notasIniciales);
    } else {
      setRubricaSeleccionada(null);
    }
  };

  const handleCambioNota = (item: string, nota: number) => {
    setNotasEvaluacion({ ...notasEvaluacion, [item]: nota });
  };

  const calcularNotaFinal = () => {
    if (!rubricaSeleccionada) return 0;
    let sumaPonderada = 0;
    rubricaSeleccionada.criterios.forEach((c) => {
      const nota = notasEvaluacion[c.item] ?? 5.0;
      sumaPonderada += nota * (c.porcentaje / 100);
    });
    return Number(sumaPonderada.toFixed(2));
  };

  const handleGuardarEvaluacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubricaSeleccionada || !nombreAlumno.trim()) {
      lanzarToast('¡Completa el nombre del alumno! 🎓', 'advertencia');
      return;
    }
    const notaFinal = calcularNotaFinal();
    try {
      await addDoc(collection(db, 'evaluaciones'), {
        alumno: nombreAlumno,
        rubricaNombre: rubricaSeleccionada.nombre,
        rubricaId: rubricaSeleccionada.id,
        notasDetalle: notasEvaluacion,
        notaFinal: notaFinal,
        fechaEvaluacion: new Date().toISOString(),
        comentarios: comentarioEvaluacion
      });
      
      // Auto-añadir alumno a listado si no existía de forma amigable
      if (!listaAlumnos.some(al => al.nombre.toLowerCase() === nombreAlumno.toLowerCase())) {
        await addDoc(collection(db, 'alumnos'), {
          nombre: nombreAlumno,
          fechaRegistro: new Date().toISOString()
        });
      }

      lanzarToast(`¡Evaluación de ${nombreAlumno} guardada! Nota: ${notaFinal} 🎉`, 'exito');
      setNombreAlumno('');
      setComentarioEvaluacion('');
      setNotasEvaluacion({});
      setRubricaSeleccionada(null);
    } catch (error) {
      console.error(error);
      lanzarToast('Error al guardar la evaluación ❌', 'error');
    }
  };

  const manejarEscrituraAlumno = (valor: string) => {
    setNombreAlumno(valor);
    if (valor.length > 0) {
      const filtrados = listaAlumnos.filter(a =>
        a.nombre.toLowerCase().includes(valor.toLowerCase())
      );
      setSugerenciasFiltradas(filtrados);
      setMostrarSugerencias(true);
    } else {
      setMostrarSugerencias(false);
    }
  };

  // Helper para obtener color adaptativo de nota
  const obtenerColorNota = (nota: number) => {
    if (nota < 5.0) return { bg: 'rgba(239, 68, 68, 0.15)', texto: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', glow: 'rgba(239, 68, 68, 0.25)', label: 'SUSPENSO' };
    if (nota < 7.0) return { bg: 'rgba(245, 158, 11, 0.15)', texto: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', glow: 'rgba(245, 158, 11, 0.25)', label: 'BIEN' };
    if (nota < 9.0) return { bg: 'rgba(16, 185, 129, 0.15)', texto: '#10b981', border: 'rgba(16, 185, 129, 0.3)', glow: 'rgba(16, 185, 129, 0.25)', label: 'NOTABLE' };
    return { bg: 'rgba(99, 102, 241, 0.15)', texto: '#6366f1', border: 'rgba(99, 102, 241, 0.3)', glow: 'rgba(99, 102, 241, 0.25)', label: 'SOBRESALIENTE' };
  };

  // Calcular analíticas globales de la clase para el dashboard superior
  const obtenerEstadisticasClase = () => {
    if (listaEvaluaciones.length === 0) return { promedio: 0, aprobadosRate: 0, notaMax: 0, total: 0, dist: { s: 0, n: 0, a: 0, i: 0 } };
    const total = listaEvaluaciones.length;
    const notas = listaEvaluaciones.map(e => e.notaFinal);
    const promedio = notas.reduce((x, y) => x + y, 0) / total;
    const notaMax = Math.max(...notas);
    const aprobados = notas.filter(n => n >= 5.0).length;
    const aprobadosRate = Math.round((aprobados / total) * 100);

    const s = notas.filter(n => n >= 9.0).length;
    const n = notas.filter(n => n >= 7.0 && n < 9.0).length;
    const a = notas.filter(n => n >= 5.0 && n < 7.0).length;
    const i = notas.filter(n => n < 5.0).length;

    return {
      promedio: Number(promedio.toFixed(2)),
      aprobadosRate,
      notaMax,
      total,
      dist: {
        s: Math.round((s / total) * 100),
        n: Math.round((n / total) * 100),
        a: Math.round((a / total) * 100),
        i: Math.round((i / total) * 100),
      }
    };
  };

  const stats = obtenerEstadisticasClase();

  // Disparar diálogo de impresión
  const lanzarImpresionBoletin = (evaluacion: Evaluacion) => {
    setBoletinImprimir(evaluacion);
    setTimeout(() => {
      window.print();
    }, 300);
  };

  return (
    <div
      style={{
        fontFamily: "'Outfit', 'Inter', system-ui, -apple-system, sans-serif",
        backgroundColor: modoOscuro ? '#0a0f1d' : '#f1f5f9',
        color: modoOscuro ? '#f1f5f9' : '#1e293b',
        minHeight: '100vh',
        padding: '30px 20px',
        boxSizing: 'border-box',
        transition: 'background-color 0.3s ease, color 0.3s ease',
        position: 'relative',
        overflowX: 'hidden'
      }}
      className="no-print"
    >
      {/* Tipografía Google Fonts Outfit/Inter */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&family=Inter:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Estilos CSS Inyectados */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          to { opacity: 0; transform: translateY(-10px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .animate-fade {
          animation: fadeIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        /* Sliders de Notas Horizontales */
        input[type="range"] {
          -webkit-appearance: none;
          width: 100%;
          height: 8px;
          border-radius: 99px;
          background: ${modoOscuro ? 'rgba(255,255,255,0.1)' : '#e2e8f0'};
          outline: none;
          transition: background 0.3s;
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          transition: transform 0.15s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }

        /* 🖨️ ESTILOS DE IMPRESIÓN OFICIAL PARA EL BOLETÍN PDF */
        @media print {
          body, html, .no-print {
            display: none !important;
            height: 0 !important;
            overflow: hidden !important;
          }
          .print-area {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            color: #000000 !important;
            background-color: #ffffff !important;
            font-family: 'Inter', sans-serif !important;
            padding: 30px !important;
          }
        }
      `}</style>

      {/* 🔮 CÍRCULOS DE LUZ EN EL FONDO GENERAL */}
      <div style={{ position: 'absolute', top: '10%', left: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '-5%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,70,239,0.06) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

      <ToastContainer toasts={toasts} />

      {/* 👑 CABECERA GENERAL */}
      <div style={{ maxWidth: '800px', margin: '0 auto 30px', display: 'flex', justifyItems: 'center', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 10 }}>
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#3b82f6', letterSpacing: '2px', textTransform: 'uppercase' }}>Portal Escolar</span>
          <h1 style={{ margin: '5px 0 0', fontSize: '2.1rem', fontWeight: '900', letterSpacing: '-1px' }}>🎓 Calificaciones y Rúbricas</h1>
        </div>

        {/* MODO OSCURO SWITCHER */}
        <button
          onClick={() => {
            setModoOscuro(!modoOscuro);
            lanzarToast(`Tema ${!modoOscuro ? 'Oscuro' : 'Claro'} activo 🌓`, 'info');
          }}
          style={{
            padding: '10px 16px',
            borderRadius: '16px',
            border: modoOscuro ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
            backgroundColor: modoOscuro ? 'rgba(30, 41, 59, 0.6)' : 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            color: modoOscuro ? '#f8fafc' : '#1e293b',
            fontWeight: 'bold',
            fontSize: '0.85rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
        >
          {modoOscuro ? '☀️ Claro' : '🌙 Oscuro'}
        </button>
      </div>

      {/* 📋 APPLE TAB MENU TABS */}
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto 35px',
          backgroundColor: modoOscuro ? 'rgba(30, 41, 59, 0.5)' : 'rgba(255, 255, 255, 0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          padding: '6px',
          borderRadius: '24px',
          display: 'flex',
          gap: '6px',
          border: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.05)',
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)',
          position: 'relative',
          zIndex: 10
        }}
      >
        {(['disenador', 'evaluador', 'historial'] as const).map((tab) => {
          const activo = pantalla === tab;
          let label = '📝 Diseñar Rúbricas';
          if (tab === 'evaluador') label = '🎓 Evaluar Alumnos';
          if (tab === 'historial') label = '📋 Historial de Notas';

          return (
            <button
              key={tab}
              onClick={() => setPantalla(tab)}
              style={{
                flex: 1,
                padding: '12px 8px',
                borderRadius: '18px',
                border: 'none',
                backgroundColor: activo ? '#3b82f6' : 'transparent',
                color: activo ? 'white' : modoOscuro ? '#94a3b8' : '#64748b',
                fontWeight: '800',
                fontSize: '0.88rem',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: activo ? '0 8px 20px rgba(59, 130, 246, 0.35)' : 'none',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseEnter={(e) => {
                if (!activo) e.currentTarget.style.color = modoOscuro ? '#f8fafc' : '#1e293b';
              }}
              onMouseLeave={(e) => {
                if (!activo) e.currentTarget.style.color = modoOscuro ? '#94a3b8' : '#64748b';
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* 📦 CONTENIDO DINÁMICO */}
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          background: modoOscuro ? 'rgba(30, 41, 59, 0.45)' : 'rgba(255, 255, 255, 0.55)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(255,255,255,0.6)',
          borderRadius: '32px',
          padding: '30px',
          boxShadow: modoOscuro ? '0 25px 50px -12px rgba(0,0,0,0.5)' : '0 20px 40px -15px rgba(0,0,0,0.08)',
          position: 'relative',
          zIndex: 10,
          boxSizing: 'border-box'
        }}
        className="animate-fade"
        key={pantalla}
      >
        {/* PANTALLA 1: DISEÑADOR */}
        {pantalla === 'disenador' && (
          <form onSubmit={handleGuardarRubrica} style={{ textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '15px' }}>
              <div>
                <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 5px', letterSpacing: '-0.5px' }}>📝 Crear Nueva Rúbrica</h2>
                <p style={{ margin: 0, color: modoOscuro ? '#94a3b8' : '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>
                  Diseña criterios desde cero o carga una plantilla predefinida y modifícala a tu gusto.
                </p>
              </div>
            </div>

            {/* BARRA DE PLANTILLAS PREDEFINIDAS */}
            <div style={{ marginTop: '25px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '800', color: modoOscuro ? '#64748b' : '#94a3b8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>💡 Rápido: Cargar Plantillas</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => cargarPlantillaPredefinida('oral')}
                  style={{ padding: '8px 14px', borderRadius: '12px', border: 'none', backgroundColor: modoOscuro ? 'rgba(59, 130, 246, 0.15)' : '#e0f2fe', color: '#0284c7', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                >
                  🗣️ Exposición Oral
                </button>
                <button
                  type="button"
                  onClick={() => cargarPlantillaPredefinida('grupo')}
                  style={{ padding: '8px 14px', borderRadius: '12px', border: 'none', backgroundColor: modoOscuro ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff', color: '#7e22ce', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                >
                  👥 Trabajo Grupal
                </button>
                <button
                  type="button"
                  onClick={() => cargarPlantillaPredefinida('mates')}
                  style={{ padding: '8px 14px', borderRadius: '12px', border: 'none', backgroundColor: modoOscuro ? 'rgba(245, 158, 11, 0.15)' : '#fef3c7', color: '#b45309', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s' }}
                >
                  🧮 Problemas Mates
                </button>
              </div>
            </div>

            <div style={{ margin: '30px 0 25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Nombre de la Rúbrica:
              </label>
              <input
                type="text"
                value={nombreRubrica}
                onChange={(e) => setNombreRubrica(e.target.value)}
                placeholder="Ej: Exposición del Trabajo de Historia..."
                required
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: '16px',
                  border: modoOscuro ? '2px solid rgba(255,255,255,0.1)' : '2px solid #e2e8f0',
                  backgroundColor: modoOscuro ? '#111827' : '#ffffff',
                  color: modoOscuro ? '#f8fafc' : '#1e293b',
                  fontSize: '1rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontWeight: '600',
                  transition: 'border-color 0.2s',
                }}
              />
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '30px 0 15px', borderBottom: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0', paddingBottom: '8px' }}>
              🎯 Criterios de Evaluación
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {criterios.map((criterio, index) => (
                <div key={index} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Criterio (Ej: Ortografía, Creatividad...)"
                    value={criterio.item}
                    onChange={(e) => handleCambioCriterio(index, 'item', e.target.value)}
                    required
                    style={{
                      flex: 4,
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: modoOscuro ? '2px solid rgba(255,255,255,0.1)' : '2px solid #e2e8f0',
                      backgroundColor: modoOscuro ? '#111827' : '#ffffff',
                      color: modoOscuro ? '#f8fafc' : '#1e293b',
                      fontSize: '0.9rem',
                      outline: 'none',
                      fontWeight: '600',
                      boxSizing: 'border-box',
                    }}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '85px' }}>
                    <input
                      type="number"
                      placeholder="%"
                      min="1"
                      max="100"
                      value={criterio.porcentaje || ''}
                      onChange={(e) => handleCambioCriterio(index, 'porcentaje', e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '12px 10px',
                        borderRadius: '14px',
                        border: modoOscuro ? '2px solid rgba(255,255,255,0.1)' : '2px solid #e2e8f0',
                        backgroundColor: modoOscuro ? '#111827' : '#ffffff',
                        color: modoOscuro ? '#f8fafc' : '#1e293b',
                        fontSize: '0.9rem',
                        outline: 'none',
                        fontWeight: '800',
                        textAlign: 'center',
                        boxSizing: 'border-box',
                      }}
                    />
                    <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>%</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleEliminarCriterio(index)}
                    style={{
                      padding: '12px',
                      borderRadius: '14px',
                      border: 'none',
                      backgroundColor: modoOscuro ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)',
                      color: '#ef4444',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>

            <div
              style={{
                marginTop: '30px',
                padding: '16px 20px',
                borderRadius: '20px',
                backgroundColor: modoOscuro ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.015)',
                border: modoOscuro ? '1px dashed rgba(255,255,255,0.1)' : '1px dashed rgba(0,0,0,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: modoOscuro ? '#94a3b8' : '#475569' }}>Total de porcentaje acumulado:</span>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: '900',
                  color: criterios.reduce((acc, curr) => acc + curr.porcentaje, 0) === 100 ? '#10b981' : '#f59e0b'
                }}
              >
                {criterios.reduce((acc, curr) => acc + curr.porcentaje, 0)}%
              </span>
            </div>

            <div style={{ marginTop: '25px', display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={handleAñadirCriterio}
                style={{ padding: '14px 22px', borderRadius: '16px', border: 'none', backgroundColor: modoOscuro ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)', color: '#3b82f6', fontWeight: '800', fontSize: '0.9rem', cursor: 'pointer', transition: 'all 0.2s' }}
              >
                ➕ Añadir Ítem
              </button>

              <button
                type="submit"
                style={{
                  padding: '14px 26px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  backgroundColor: '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  marginLeft: 'auto',
                  boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
                }}
              >
                💾 Guardar Rúbrica
              </button>
            </div>
          </form>
        )}

        {/* PANTALLA 2: EVALUADOR */}
        {pantalla === 'evaluador' && (
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 10px', letterSpacing: '-0.5px', textAlign: 'left' }}>🎓 Evaluar Alumno</h2>
            <p style={{ margin: '0 0 25px', color: modoOscuro ? '#94a3b8' : '#64748b', fontSize: '0.9rem', fontWeight: '500', textAlign: 'left' }}>
              Elige una rúbrica, carga el listado de alumnos o introduce uno a mano, y califica usando los deslizadores interactivos.
            </p>

            {/* SECCIÓN CARGA DE ARCHIVO DE ALUMNOS */}
            <div
              style={{
                border: modoOscuro ? '2px dashed rgba(255,255,255,0.1)' : '2px dashed rgba(0,0,0,0.1)',
                padding: '20px',
                borderRadius: '24px',
                backgroundColor: modoOscuro ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.005)',
                textAlign: 'left',
                marginBottom: '25px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '10px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px' }}>📁 IMPORTAR LISTADO DE ALUMNOS (TXT / CSV)</span>
                {listaAlumnos.length > 0 && (
                  <button
                    type="button"
                    onClick={vaciarListaAlumnos}
                    style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '0.78rem', fontWeight: 'bold', cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    🗑️ Vaciar Listado ({listaAlumnos.length} cargados)
                  </button>
                )}
              </div>
              <p style={{ margin: '0 0 15px', fontSize: '0.8rem', color: modoOscuro ? '#64748b' : '#94a3b8', fontWeight: '500' }}>
                Sube un archivo `.txt` o `.csv` con un nombre de alumno por línea. Se guardarán de forma segura en Firestore para su autocompletado automático.
              </p>
              
              <input
                type="file"
                accept=".txt,.csv"
                onChange={procesarArchivoAlumnos}
                style={{
                  fontSize: '0.8rem',
                  color: modoOscuro ? '#94a3b8' : '#64748b',
                  cursor: 'pointer'
                }}
              />
            </div>

            <div style={{ marginBottom: '25px', textAlign: 'left' }}>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                1. Elige una Rúbrica:
              </label>
              <select
                onChange={(e) => handleSeleccionarRubrica(e.target.value)}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '16px',
                  border: modoOscuro ? '2px solid rgba(255,255,255,0.1)' : '2px solid #e2e8f0',
                  backgroundColor: modoOscuro ? '#111827' : '#ffffff',
                  color: modoOscuro ? '#f8fafc' : '#1e293b',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  outline: 'none',
                  cursor: 'pointer',
                }}
                defaultValue=""
              >
                <option value="" disabled>-- Selecciona una rúbrica guardada --</option>
                {listaRubricas.map((r) => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>
            </div>

            {rubricaSeleccionada && (
              <form
                onSubmit={handleGuardarEvaluacion}
                style={{
                  border: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0',
                  padding: '24px',
                  borderRadius: '24px',
                  backgroundColor: modoOscuro ? 'rgba(17, 24, 39, 0.4)' : 'rgba(0, 0, 0, 0.015)',
                  textAlign: 'left',
                  marginTop: '30px',
                  animation: 'fadeIn 0.3s ease-out'
                }}
              >
                <h3 style={{ margin: '0 0 20px', fontSize: '1.25rem', fontWeight: '800', borderBottom: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  ⭐ Rúbrica: {rubricaSeleccionada.nombre}
                </h3>

                {/* CAMPO COMBOBOX AUTOCOMPLETE */}
                <div style={{ marginBottom: '25px', position: 'relative' }} ref={dropdownRef}>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Nombre del Alumno:
                  </label>
                  <input
                    type="text"
                    value={nombreAlumno}
                    onChange={(e) => manejarEscrituraAlumno(e.target.value)}
                    onFocus={() => { if (nombreAlumno.length > 0) setMostrarSugerencias(true); }}
                    placeholder="Escribe o selecciona un alumno..."
                    required
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '14px',
                      border: modoOscuro ? '2px solid rgba(255,255,255,0.1)' : '2px solid #e2e8f0',
                      backgroundColor: modoOscuro ? '#111827' : '#ffffff',
                      color: modoOscuro ? '#f8fafc' : '#1e293b',
                      fontSize: '1rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: '600',
                    }}
                  />

                  {/* Sugerencias desplegables */}
                  {mostrarSugerencias && sugerenciasFiltradas.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      width: '100%',
                      backgroundColor: modoOscuro ? '#1f2937' : '#ffffff',
                      border: modoOscuro ? '1px solid rgba(255,255,255,0.1)' : '1px solid #e2e8f0',
                      borderRadius: '14px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 1000,
                      marginTop: '5px'
                    }}>
                      {sugerenciasFiltradas.map((a) => (
                        <div
                          key={a.id}
                          onClick={() => {
                            setNombreAlumno(a.nombre);
                            setMostrarSugerencias(false);
                          }}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            borderBottom: modoOscuro ? '1px solid rgba(255,255,255,0.05)' : '1px solid #f1f5f9',
                            transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(255,255,255,0.05)' : '#f1f5f9'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          👤 {a.nombre}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: '25px 0 15px', color: modoOscuro ? '#94a3b8' : '#475569', textTransform: 'uppercase' }}>
                  Notas por Criterio (0.0 al 10.0)
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {rubricaSeleccionada.criterios.map((c, index) => {
                    const notaCriterio = notasEvaluacion[c.item] ?? 5.0;
                    const configColor = obtenerColorNota(notaCriterio);

                    return (
                      <div
                        key={index}
                        style={{
                          padding: '16px',
                          borderRadius: '20px',
                          backgroundColor: modoOscuro ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.9)',
                          border: modoOscuro ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.03)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ fontSize: '0.95rem' }}>{c.item}</strong>
                            <span style={{ color: modoOscuro ? '#64748b' : '#94a3b8', fontSize: '0.78rem', fontWeight: 'bold', marginLeft: '5px' }}>
                              ({c.porcentaje}%)
                            </span>
                          </div>

                          <div style={{
                            padding: '5px 12px',
                            borderRadius: '99px',
                            fontSize: '0.85rem',
                            fontWeight: '900',
                            backgroundColor: configColor.bg,
                            color: configColor.texto,
                            border: `1px solid ${configColor.border}`,
                            boxShadow: `0 2px 10px ${configColor.glow}`,
                            minWidth: '55px',
                            textAlign: 'center'
                          }}>
                            {notaCriterio.toFixed(1)}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#ef4444' }}>0</span>
                          <input
                            type="range"
                            min="0"
                            max="10"
                            step="0.1"
                            value={notaCriterio}
                            onChange={(e) => handleCambioNota(c.item, parseFloat(e.target.value))}
                            required
                          />
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#10b981' }}>10</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* CAMPO DE RETROALIMENTACIÓN / COMENTARIOS */}
                <div style={{ marginTop: '25px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    ✍️ Comentarios de Retroalimentación (Feedback):
                  </label>
                  <textarea
                    value={comentarioEvaluacion}
                    onChange={(e) => setComentarioEvaluacion(e.target.value)}
                    placeholder="Escribe aquí tus observaciones pedagógicas, sugerencias de mejora o felicitaciones para el alumno..."
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: '16px',
                      border: modoOscuro ? '2px solid rgba(255,255,255,0.1)' : '2px solid #e2e8f0',
                      backgroundColor: modoOscuro ? '#111827' : '#ffffff',
                      color: modoOscuro ? '#f8fafc' : '#1e293b',
                      fontSize: '0.95rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      fontWeight: '600',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                </div>

                {/* NOTA FINAL GENERAL */}
                {(() => {
                  const notaFinal = calcularNotaFinal();
                  const colorFinal = obtenerColorNota(notaFinal);

                  return (
                    <div
                      style={{
                        marginTop: '30px',
                        padding: '20px',
                        backgroundColor: modoOscuro ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                        borderRadius: '24px',
                        border: modoOscuro ? '1px solid rgba(255,255,255,0.06)' : '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <span style={{ fontSize: '0.75rem', fontWeight: '900', color: modoOscuro ? '#64748b' : '#94a3b8', letterSpacing: '1px', textTransform: 'uppercase' }}>Calificación Final</span>
                        <h4 style={{ margin: '3px 0 0', fontSize: '1.15rem', fontWeight: '800' }}>PROMEDIO PONDERADO</h4>
                      </div>

                      <div
                        style={{
                          fontSize: '2rem',
                          fontWeight: '900',
                          padding: '6px 20px',
                          borderRadius: '16px',
                          backgroundColor: colorFinal.bg,
                          color: colorFinal.texto,
                          border: `2px solid ${colorFinal.border}`,
                          boxShadow: `0 4px 18px ${colorFinal.glow}`,
                          minWidth: '90px',
                          textAlign: 'center'
                        }}
                      >
                        {notaFinal.toFixed(2)}
                      </div>
                    </div>
                  );
                })()}

                <button
                  type="submit"
                  style={{
                    width: '100%',
                    marginTop: '25px',
                    padding: '14px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '18px',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    fontWeight: '800',
                    boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.2s',
                  }}
                >
                  💾 Guardar Notas y Registrar
                </button>
              </form>
            )}
          </div>
        )}

        {/* PANTALLA 3: HISTORIAL DE NOTAS Y ANALÍTICAS */}
        {pantalla === 'historial' && (
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 10px', letterSpacing: '-0.5px', textAlign: 'left' }}>📋 Historial y Analítica de Clase</h2>
            <p style={{ margin: '0 0 25px', color: modoOscuro ? '#94a3b8' : '#64748b', fontSize: '0.9rem', fontWeight: '500', textAlign: 'left' }}>
              Analíticas de rendimiento y calificaciones. Haz clic en una fila para expandir detalles, ver feedback y descargar boletines oficiales en PDF.
            </p>

            {/* 📊 PANEL DE ANALÍTICA SUPERIOR (KPI CARDS) */}
            {listaEvaluaciones.length > 0 && (
              <div style={{ marginBottom: '30px', animation: 'fadeIn 0.4s ease-out' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                  
                  {/* KPI: Nota Media */}
                  <div style={{ padding: '16px', borderRadius: '24px', backgroundColor: modoOscuro ? 'rgba(255,255,255,0.02)' : '#ffffff', border: modoOscuro ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: modoOscuro ? '#64748b' : '#94a3b8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Nota Media</span>
                    <h3 style={{ margin: '8px 0 0', fontSize: '1.8rem', fontWeight: '900', color: '#3b82f6' }}>{stats.promedio.toFixed(2)}</h3>
                  </div>

                  {/* KPI: Tasa de Aprobado */}
                  <div style={{ padding: '16px', borderRadius: '24px', backgroundColor: modoOscuro ? 'rgba(255,255,255,0.02)' : '#ffffff', border: modoOscuro ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: modoOscuro ? '#64748b' : '#94a3b8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Tasa Aprobados</span>
                    <h3 style={{ margin: '8px 0 0', fontSize: '1.8rem', fontWeight: '900', color: '#10b981' }}>{stats.aprobadosRate}%</h3>
                  </div>

                  {/* KPI: Nota Máxima */}
                  <div style={{ padding: '16px', borderRadius: '24px', backgroundColor: modoOscuro ? 'rgba(255,255,255,0.02)' : '#ffffff', border: modoOscuro ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: modoOscuro ? '#64748b' : '#94a3b8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Nota Máxima</span>
                    <h3 style={{ margin: '8px 0 0', fontSize: '1.8rem', fontWeight: '900', color: '#6366f1' }}>{stats.notaMax.toFixed(1)}</h3>
                  </div>

                  {/* KPI: Evaluados */}
                  <div style={{ padding: '16px', borderRadius: '24px', backgroundColor: modoOscuro ? 'rgba(255,255,255,0.02)' : '#ffffff', border: modoOscuro ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0', textAlign: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.01)' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '800', color: modoOscuro ? '#64748b' : '#94a3b8', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Evaluados</span>
                    <h3 style={{ margin: '8px 0 0', fontSize: '1.8rem', fontWeight: '900', color: modoOscuro ? '#f8fafc' : '#1e293b' }}>{stats.total}</h3>
                  </div>
                </div>

                {/* Barra de distribución en colores */}
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '800', marginBottom: '6px', color: modoOscuro ? '#64748b' : '#94a3b8' }}>
                    <span>DISTRIBUCIÓN DE CALIFICACIONES</span>
                  </div>
                  <div style={{ display: 'flex', height: '12px', borderRadius: '99px', overflow: 'hidden', backgroundColor: modoOscuro ? 'rgba(255,255,255,0.05)' : '#e2e8f0' }}>
                    <div style={{ width: `${stats.dist.s}%`, backgroundColor: '#6366f1', transition: 'width 0.3s' }} title={`Sobresalientes: ${stats.dist.s}%`} />
                    <div style={{ width: `${stats.dist.n}%`, backgroundColor: '#10b981', transition: 'width 0.3s' }} title={`Notables: ${stats.dist.n}%`} />
                    <div style={{ width: `${stats.dist.a}%`, backgroundColor: '#f59e0b', transition: 'width 0.3s' }} title={`Aprobados: ${stats.dist.a}%`} />
                    <div style={{ width: `${stats.dist.i}%`, backgroundColor: '#ef4444', transition: 'width 0.3s' }} title={`Suspenso: ${stats.dist.i}%`} />
                  </div>
                  <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: '10px', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366f1' }} /> Sobresaliente ({stats.dist.s}%)</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }} /> Notable ({stats.dist.n}%)</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b' }} /> Aprobado ({stats.dist.a}%)</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}><div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ef4444' }} /> Suspenso ({stats.dist.i}%)</span>
                  </div>
                </div>
              </div>
            )}

            {cargando && (
              <div style={{ overflowX: 'auto', width: '100%' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                  <thead>
                    <tr style={{ borderBottom: modoOscuro ? '2px solid rgba(255,255,255,0.08)' : '2px solid #e2e8f0', textAlign: 'left' }}>
                      <th style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '800', color: '#3b82f6', letterSpacing: '0.5px' }}>ALUMNO</th>
                      <th style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '800', color: '#3b82f6', letterSpacing: '0.5px' }}>RÚBRICA USADA</th>
                      <th style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '800', color: '#3b82f6', letterSpacing: '0.5px' }}>FECHA</th>
                      <th style={{ padding: '12px', fontSize: '0.8rem', fontWeight: '800', color: '#3b82f6', letterSpacing: '0.5px', textAlign: 'center' }}>NOTA FINAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </tbody>
                </table>
              </div>
            )}

            {!cargando && listaEvaluaciones.length === 0 && (
              <div style={{ padding: '40px 10px', textAlign: 'center', border: '2px dashed rgba(148, 163, 184, 0.3)', borderRadius: '24px', margin: '20px 0' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1rem', color: modoOscuro ? '#94a3b8' : '#64748b' }}>
                  📭 Aún no hay evaluaciones registradas en el historial de Firebase.
                </p>
              </div>
            )}

            {!cargando && listaEvaluaciones.length > 0 && (
              <div style={{ overflowX: 'auto', width: '100%', borderRadius: '24px', border: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.01)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.95rem' }}>
                  <thead>
                    <tr style={{ backgroundColor: modoOscuro ? 'rgba(255,255,255,0.02)' : '#f8fafc', borderBottom: modoOscuro ? '2px solid rgba(255,255,255,0.08)' : '2px solid #e2e8f0' }}>
                      <th style={{ padding: '16px', fontSize: '0.8rem', fontWeight: '800', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px' }}>ESTUDIANTE</th>
                      <th style={{ padding: '16px', fontSize: '0.8rem', fontWeight: '800', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px' }}>RÚBRICA USADA</th>
                      <th style={{ padding: '16px', fontSize: '0.8rem', fontWeight: '800', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px' }}>FECHA</th>
                      <th style={{ padding: '16px', fontSize: '0.8rem', fontWeight: '800', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px', textAlign: 'center' }}>NOTA FINAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaEvaluaciones.map((ev, index) => {
                      const colorEv = obtenerColorNota(ev.notaFinal);
                      const bgFila = index % 2 === 0 ? 'transparent' : modoOscuro ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.005)';
                      const expandida = expandidoId === ev.id;

                      return (
                        <React.Fragment key={ev.id}>
                          <tr
                            onClick={() => setExpandidoId(expandida ? null : ev.id)}
                            style={{
                              borderBottom: modoOscuro ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0',
                              backgroundColor: expandida ? (modoOscuro ? 'rgba(59, 130, 246, 0.08)' : '#eff6ff') : bgFila,
                              transition: 'background-color 0.2s',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => { if (!expandida) e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)'; }}
                            onMouseLeave={(e) => { if (!expandida) e.currentTarget.style.backgroundColor = bgFila; }}
                          >
                            <td style={{ padding: '16px', fontWeight: 'bold', color: modoOscuro ? '#f8fafc' : '#1e293b' }}>
                              {expandida ? '👇 ' : '👉 '} {ev.alumno}
                            </td>
                            <td style={{ padding: '16px', color: modoOscuro ? '#94a3b8' : '#475569', fontWeight: '600' }}>
                              {ev.rubricaNombre}
                            </td>
                            <td style={{ padding: '16px', fontSize: '0.82rem', color: modoOscuro ? '#64748b' : '#94a3b8', fontWeight: '600' }}>
                              {new Date(ev.fechaEvaluacion).toLocaleDateString()}
                            </td>
                            <td style={{ padding: '16px', textAlign: 'center' }}>
                              <span style={{
                                padding: '6px 14px',
                                borderRadius: '10px',
                                fontWeight: '900',
                                fontSize: '0.85rem',
                                backgroundColor: colorEv.bg,
                                color: colorEv.texto,
                                border: `1px solid ${colorEv.border}`,
                                boxShadow: `0 2px 10px ${colorEv.glow}`,
                                display: 'inline-block',
                                minWidth: '45px'
                              }}>
                                {ev.notaFinal.toFixed(2)}
                              </span>
                            </td>
                          </tr>

                          {/* FILA EXPANDIBLE DETALLE */}
                          {expandida && (
                            <tr>
                              <td colSpan={4} style={{
                                padding: '24px',
                                backgroundColor: modoOscuro ? 'rgba(15, 23, 42, 0.4)' : '#f8fafc',
                                borderBottom: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0'
                              }}>
                                <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                  
                                  {/* Desglose de Criterios */}
                                  <div>
                                    <h4 style={{ margin: '0 0 12px', fontSize: '0.85rem', color: modoOscuro ? '#94a3b8' : '#475569', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>📊 Desglose de Calificaciones</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                                      {Object.entries(ev.notasDetalle).map(([criterio, nota]) => {
                                        const colParcial = obtenerColorNota(nota);
                                        return (
                                          <div key={criterio} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', backgroundColor: modoOscuro ? 'rgba(255,255,255,0.02)' : '#ffffff', border: modoOscuro ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{criterio}</span>
                                            <span style={{ fontWeight: '800', color: colParcial.texto, fontSize: '0.85rem' }}>{nota.toFixed(1)}</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Sección de retroalimentación de texto */}
                                  {ev.comentarios && (
                                    <div style={{ padding: '14px 16px', borderRadius: '16px', backgroundColor: modoOscuro ? 'rgba(255,255,255,0.02)' : '#ffffff', borderLeft: '4px solid #3b82f6', border: modoOscuro ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0' }}>
                                      <h5 style={{ margin: '0 0 5px', fontSize: '0.78rem', color: '#3b82f6', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>✍️ Observaciones Pedagógicas (Feedback)</h5>
                                      <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: '600', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{ev.comentarios}</p>
                                    </div>
                                  )}

                                  {/* Botón de Impresión de boletín */}
                                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '5px' }}>
                                    <button
                                      type="button"
                                      onClick={() => lanzarImpresionBoletin(ev)}
                                      style={{
                                        padding: '10px 18px',
                                        borderRadius: '12px',
                                        border: 'none',
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        fontWeight: '800',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}
                                    >
                                      <span>🖨️ Exportar Boletín PDF</span>
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 🖨️ BOLETÍN OFICIAL EN ÁREA DE IMPRESIÓN EXCLUSIVA (OCULTO EN WEB, VISIBLE EN IMPRESORA/PDF) */}
      {boletinImprimir && (
        <div className="print-area" style={{ display: 'none' }}>
          
          {/* Cabecera oficial del colegio */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '3px double #000000', paddingBottom: '15px', marginBottom: '30px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: '900', letterSpacing: '-0.5px' }}>Colegio San Buenaventura</h1>
              <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: '#555', fontWeight: 'bold' }}>Departamento de Calificaciones Académicas y Rúbricas</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ display: 'inline-block', padding: '6px 12px', border: '1px solid #000000', fontWeight: 'bold', fontSize: '0.8rem' }}>BOLETÍN EVALUATIVO</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '35px', fontSize: '0.95rem' }}>
            <div>
              <p style={{ margin: '0 0 8px' }}><strong>Estudiante:</strong> {boletinImprimir.alumno}</p>
              <p style={{ margin: 0 }}><strong>Rúbrica Utilizada:</strong> {boletinImprimir.rubricaNombre}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: '0 0 8px' }}><strong>Fecha Emisión:</strong> {new Date(boletinImprimir.fechaEvaluacion).toLocaleDateString()}</p>
              <p style={{ margin: 0 }}><strong>Hora Registro:</strong> {new Date(boletinImprimir.fechaEvaluacion).toLocaleTimeString()}</p>
            </div>
          </div>

          <h3 style={{ borderBottom: '1px solid #000000', paddingBottom: '8px', fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '15px' }}>📊 Desglose de Criterios y Calificaciones</h3>

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '35px', fontSize: '0.95rem' }}>
            <thead>
              <tr style={{ backgroundColor: '#f2f2f2', borderBottom: '1px solid #000', textAlign: 'left' }}>
                <th style={{ padding: '10px', border: '1px solid #000' }}>Criterio</th>
                <th style={{ padding: '10px', border: '1px solid #000', width: '120px', textAlign: 'center' }}>Peso (%)</th>
                <th style={{ padding: '10px', border: '1px solid #000', width: '120px', textAlign: 'center' }}>Nota (0-10)</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(boletinImprimir.notasDetalle).map(([criterio, nota]) => {
                const rub = listaRubricas.find(r => r.nombre === boletinImprimir.rubricaNombre);
                const crit = rub?.criterios.find(c => c.item === criterio);
                const porcentaje = crit?.porcentaje ?? 0;

                return (
                  <tr key={criterio} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '10px', border: '1px solid #000' }}>{criterio}</td>
                    <td style={{ padding: '10px', border: '1px solid #000', textAlign: 'center' }}>{porcentaje}%</td>
                    <td style={{ padding: '10px', border: '1px solid #000', textAlign: 'center', fontWeight: 'bold' }}>{nota.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Calificación Final Destacada */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', border: '2px solid #000000', backgroundColor: '#f9f9f9', marginBottom: '35px', borderRadius: '4px' }}>
            <span style={{ fontSize: '1rem', fontWeight: 'bold' }}>NOTA PROMEDIO GENERAL PONDERADA:</span>
            <span style={{ fontSize: '1.8rem', fontWeight: '900' }}>{boletinImprimir.notaFinal.toFixed(2)}</span>
          </div>

          {/* Retroalimentación */}
          {boletinImprimir.comentarios && (
            <div style={{ padding: '15px', border: '1px solid #000', borderRadius: '4px', marginBottom: '50px', fontSize: '0.95rem' }}>
              <h4 style={{ margin: '0 0 8px', fontSize: '0.95rem', fontWeight: 'bold' }}>✍️ Observaciones Pedagógicas (Feedback del Docente)</h4>
              <p style={{ margin: 0, lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{boletinImprimir.comentarios}</p>
            </div>
          )}

          {/* Firmas de conformidad */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '50px', marginTop: '80px', fontSize: '0.85rem', textAlign: 'center' }}>
            <div>
              <div style={{ width: '200px', margin: '0 auto', borderBottom: '1px solid #000000', height: '40px' }} />
              <p style={{ marginTop: '10px', fontWeight: 'bold' }}>Firma del Evaluador / Docente</p>
            </div>
            <div>
              <div style={{ width: '200px', margin: '0 auto', borderBottom: '1px solid #000000', height: '40px' }} />
              <p style={{ marginTop: '10px', fontWeight: 'bold' }}>Firma del Centro de Calificaciones</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
