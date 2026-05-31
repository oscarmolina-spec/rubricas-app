import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc, onSnapshot, query } from 'firebase/firestore';

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

  // 🌟 NUEVOS ESTADOS PREMIUM
  const [toasts, setToasts] = useState<{ id: number; mensaje: string; tipo: string }[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modoOscuro, setModoOscuro] = useState(false); // 🌓 Control del Modo Oscuro

  // Helper para lanzar Toasts flotantes
  const lanzarToast = (mensaje: string, tipo = 'exito') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, mensaje, tipo }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // ☁️ ESCUCHAS EN TIEMPO REAL CON FIRESTORE (onSnapshot)
  useEffect(() => {
    setCargando(true);
    let unsub = () => {};

    if (pantalla === 'evaluador') {
      const q = query(collection(db, 'rubricas'));
      unsub = onSnapshot(q, (snapshot) => {
        const rubricasCargadas: Rubrica[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          nombre: doc.data().nombre,
          criterios: doc.data().criterios || [],
        }));
        setListaRubricas(rubricasCargadas);
        setCargando(false);
      }, (error) => {
        console.error('Error al cargar rúbricas:', error);
        lanzarToast('Error al conectar con la base de datos de rúbricas ☁️', 'error');
        setCargando(false);
      });
    } else if (pantalla === 'historial') {
      const q = query(collection(db, 'evaluaciones'));
      unsub = onSnapshot(q, (snapshot) => {
        const evaluacionesCargadas: Evaluacion[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          alumno: doc.data().alumno,
          rubricaNombre: doc.data().rubricaNombre,
          notaFinal: doc.data().notaFinal,
          fechaEvaluacion: doc.data().fechaEvaluacion,
          notasDetalle: doc.data().notasDetalle || {},
        }));
        // Ordenar por fecha para que las más recientes salgan arriba
        evaluacionesCargadas.sort(
          (a, b) => new Date(b.fechaEvaluacion).getTime() - new Date(a.fechaEvaluacion).getTime()
        );
        setListaEvaluaciones(evaluacionesCargadas);
        setCargando(false);
      }, (error) => {
        console.error('Error al cargar evaluaciones:', error);
        lanzarToast('Error al conectar con el historial de evaluaciones ☁️', 'error');
        setCargando(false);
      });
    } else {
      setCargando(false);
    }

    return () => unsub();
  }, [pantalla]);

  // Resetear estados al cambiar de pantalla
  useEffect(() => {
    if (pantalla === 'evaluador') {
      setRubricaSeleccionada(null);
      setNombreAlumno('');
      setNotasEvaluacion({});
    }
  }, [pantalla]);

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
        notasIniciales[c.item] = 5.0; // Comenzar en una nota media de 5.0 por defecto
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
      });
      lanzarToast(`¡Evaluación de ${nombreAlumno} guardada! Nota: ${notaFinal} 🎉`, 'exito');
      setNombreAlumno('');
      setNotasEvaluacion({});
      setRubricaSeleccionada(null);
    } catch (error) {
      console.error(error);
      lanzarToast('Error al guardar la evaluación ❌', 'error');
    }
  };

  // Helper para obtener color adaptativo de nota
  const obtenerColorNota = (nota: number) => {
    if (nota < 5.0) return { bg: 'rgba(239, 68, 68, 0.15)', texto: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', glow: 'rgba(239, 68, 68, 0.25)' }; // Rojo
    if (nota < 7.0) return { bg: 'rgba(245, 158, 11, 0.15)', texto: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', glow: 'rgba(245, 158, 11, 0.25)' }; // Naranja / Ámbar
    return { bg: 'rgba(16, 185, 129, 0.15)', texto: '#10b981', border: 'rgba(16, 185, 129, 0.3)', glow: 'rgba(16, 185, 129, 0.25)' }; // Verde Esmeralda
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
    >
      {/* Carga de la tipografía Outfit */}
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;800;900&family=Inter:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Bloque de estilos globales e inyectados */}
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
        /* Personalización de los deslizadores (Sliders) táctiles */
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
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(59, 130, 246, 0.5);
          transition: transform 0.1s ease;
        }
        input[type="range"]::-webkit-slider-thumb:hover {
          transform: scale(1.2);
        }
      `}</style>

      {/* 🔮 CÍRCULOS DE LUZ EN EL FONDO GENERAL */}
      <div style={{ position: 'absolute', top: '10%', left: '-5%', width: '400px', height: '400px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(50px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '15%', right: '-5%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(217,70,239,0.06) 0%, rgba(0,0,0,0) 70%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />

      <ToastContainer toasts={toasts} />

      {/* 👑 CABECERA DASHBOARD GENERAL */}
      <div
        style={{
          maxWidth: '800px',
          margin: '0 auto 30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'relative',
          zIndex: 10
        }}
      >
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: '800', color: '#3b82f6', letterSpacing: '2px', textTransform: 'uppercase' }}>Portal de Evaluación</span>
          <h1 style={{ margin: '5px 0 0', fontSize: '2.2rem', fontWeight: '900', letterSpacing: '-1px' }}>🎓 Rúbricas Inteligentes</h1>
        </div>

        {/* 🌓 CONMUTADOR MODO OSCURO */}
        <button
          onClick={() => {
            setModoOscuro(!modoOscuro);
            lanzarToast(`Modo ${!modoOscuro ? 'Oscuro' : 'Claro'} activado 🌓`, 'info');
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
            boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
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

      {/* 📋 MENÚ DE PESTAÑAS (Estilo Apple, Premium e Interactivo) */}
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

      {/* 📦 CONTENIDO DINÁMICO PRINCIPAL (Con efecto Cristal Glassmorphism) */}
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
        key={pantalla} // Fuerza re-montaje con animación fluid al cambiar pestaña
      >
        {/* PANTALLA 1: DISEÑADOR */}
        {pantalla === 'disenador' && (
          <form onSubmit={handleGuardarRubrica} style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 10px', letterSpacing: '-0.5px' }}>📝 Crear Nueva Rúbrica</h2>
            <p style={{ margin: '0 0 25px', color: modoOscuro ? '#94a3b8' : '#64748b', fontSize: '0.9rem', fontWeight: '500' }}>
              Define el nombre del examen o proyecto escolar y añade los criterios de evaluación. Recuerda que la ponderación total debe sumar exactamente el 100%.
            </p>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                Nombre de la Rúbrica:
              </label>
              <input
                type="text"
                value={nombreRubrica}
                onChange={(e) => setNombreRubrica(e.target.value)}
                placeholder="Ej: Exposición Oral de Ciencias, Proyecto de Tecnología..."
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
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = modoOscuro ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}
              />
            </div>

            <h3 style={{ fontSize: '1.1rem', fontWeight: '800', margin: '30px 0 15px', borderBottom: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0', paddingBottom: '8px' }}>
              🎯 Criterios de Evaluación
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {criterios.map((criterio, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    gap: '12px',
                    alignItems: 'center',
                    animation: 'fadeIn 0.3s ease-out'
                  }}
                >
                  <input
                    type="text"
                    placeholder="Ej: Pronunciación, Expresión Corporal, Ortografía..."
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
                      transition: 'all 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = modoOscuro ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}
                  />

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '90px' }}>
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
                        transition: 'all 0.2s',
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = modoOscuro ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}
                    />
                    <span style={{ fontWeight: '800', fontSize: '0.95rem' }}>%</span>
                  </div>

                  {/* Botón para Eliminar Criterio */}
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
                      fontWeight: 'bold',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#ef4444';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.08)';
                      e.currentTarget.style.color = '#ef4444';
                    }}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>

            {/* Sumatorio y Botones de acción */}
            <div
              style={{
                marginTop: '30px',
                padding: '16px 20px',
                borderRadius: '20px',
                backgroundColor: modoOscuro ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
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
                style={{
                  padding: '14px 22px',
                  borderRadius: '16px',
                  border: 'none',
                  backgroundColor: modoOscuro ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)',
                  color: '#3b82f6',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#3b82f6';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.08)';
                  e.currentTarget.style.color = '#3b82f6';
                }}
              >
                ➕ Añadir Ítem
              </button>

              <button
                type="submit"
                style={{
                  padding: '14px 26px',
                  backgroundColor: 'linear-gradient(135deg, #10b981, #059669)',
                  backgroundColor: '#10b981', // Fallback
                  color: 'white',
                  border: 'none',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  fontWeight: '800',
                  fontSize: '0.9rem',
                  marginLeft: 'auto',
                  boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 10px 22px rgba(16, 185, 129, 0.35)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.25)';
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
              Elige una rúbrica guardada en la base de datos de Firebase, escribe el nombre del estudiante y califica cada ítem usando los deslizadores.
            </p>

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
                  boxShadow: '0 4px 12px rgba(0,0,0,0.02)',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = modoOscuro ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}
                defaultValue=""
              >
                <option value="" disabled>
                  -- Selecciona una rúbrica guardada --
                </option>
                {listaRubricas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nombre}
                  </option>
                ))}
              </select>
            </div>

            {/* SKELETON LOADER MIENTRAS ENCUENTRA RÚBRICAS */}
            {cargando && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '30px 0', alignItems: 'center' }}>
                <div style={{ animation: 'pulse 1.5s infinite ease-in-out', height: '20px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '4px', width: '40%' }} />
                <div style={{ animation: 'pulse 1.5s infinite ease-in-out', height: '14px', backgroundColor: 'rgba(148, 163, 184, 0.2)', borderRadius: '4px', width: '60%' }} />
              </div>
            )}

            {!cargando && listaRubricas.length === 0 && (
              <div style={{ padding: '30px 10px', textAlign: 'center', border: '2px dashed rgba(148, 163, 184, 0.3)', borderRadius: '24px', margin: '20px 0' }}>
                <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1rem', color: modoOscuro ? '#94a3b8' : '#64748b' }}>
                  📭 No hay rúbricas guardadas en tu Firebase. ¡Crea una en la pestaña Diseñar!
                </p>
              </div>
            )}

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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0', paddingBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '800' }}>⭐ Evaluando con: {rubricaSeleccionada.nombre}</h3>
                </div>

                <div style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '8px', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    Nombre del Alumno:
                  </label>
                  <input
                    type="text"
                    value={nombreAlumno}
                    onChange={(e) => setNombreAlumno(e.target.value)}
                    placeholder="Escribe el nombre completo..."
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
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = modoOscuro ? 'rgba(255,255,255,0.1)' : '#e2e8f0'}
                  />
                </div>

                <h4 style={{ fontSize: '0.95rem', fontWeight: '800', margin: '25px 0 15px', color: modoOscuro ? '#94a3b8' : '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
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
                          boxShadow: '0 4px 10px rgba(0,0,0,0.01)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px'
                        }}
                      >
                        {/* Cabecera del criterio */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong style={{ fontSize: '1rem', color: modoOscuro ? '#f8fafc' : '#1e293b' }}>{c.item}</strong>{' '}
                            <span style={{ color: modoOscuro ? '#64748b' : '#94a3b8', fontSize: '0.78rem', fontWeight: 'bold', marginLeft: '5px' }}>
                              ({c.porcentaje}%)
                            </span>
                          </div>

                          {/* Burbuja de nota adaptativa */}
                          <div
                            style={{
                              padding: '5px 12px',
                              borderRadius: '99px',
                              fontSize: '0.85rem',
                              fontWeight: '900',
                              backgroundColor: configColor.bg,
                              color: configColor.texto,
                              border: `1px solid ${configColor.border}`,
                              boxShadow: `0 2px 10px ${configColor.glow}`,
                              transition: 'all 0.2s ease',
                              textAlign: 'center',
                              minWidth: '55px'
                            }}
                          >
                            {notaCriterio.toFixed(1)}
                          </div>
                        </div>

                        {/* Deslizador (Slider) Táctil */}
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
                        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.01)'
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
                          transition: 'all 0.3s ease',
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
                    backgroundColor: '#10b981', // Fallback
                    color: 'white',
                    border: 'none',
                    borderRadius: '18px',
                    fontSize: '1rem',
                    cursor: 'pointer',
                    fontWeight: '800',
                    boxShadow: '0 8px 20px rgba(16, 185, 129, 0.25)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 22px rgba(16, 185, 129, 0.35)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 8px 20px rgba(16, 185, 129, 0.25)';
                  }}
                >
                  💾 Guardar Notas en Firestore
                </button>
              </form>
            )}
          </div>
        )}

        {/* PANTALLA 3: HISTORIAL DE NOTAS */}
        {pantalla === 'historial' && (
          <div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: '800', margin: '0 0 10px', letterSpacing: '-0.5px', textAlign: 'left' }}>📋 Historial de Alumnos Evaluados</h2>
            <p style={{ margin: '0 0 25px', color: modoOscuro ? '#94a3b8' : '#64748b', fontSize: '0.9rem', fontWeight: '500', textAlign: 'left' }}>
              Lista de calificaciones guardadas en tiempo real. Los alumnos aprobados se destacan en verde brillante y los suspensos en rojo.
            </p>

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
              <div style={{ overflowX: 'auto', width: '100%', borderRadius: '20px', border: modoOscuro ? '1px solid rgba(255,255,255,0.08)' : '1px solid #e2e8f0', boxShadow: '0 4px 15px rgba(0,0,0,0.01)' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    textAlign: 'left',
                    fontSize: '0.95rem'
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        backgroundColor: modoOscuro ? 'rgba(255,255,255,0.02)' : '#f8fafc',
                        borderBottom: modoOscuro ? '2px solid rgba(255,255,255,0.08)' : '2px solid #e2e8f0',
                      }}
                    >
                      <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: '800', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px' }}>ESTUDIANTE</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: '800', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px' }}>RÚBRICA USADA</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: '800', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px' }}>FECHA</th>
                      <th style={{ padding: '14px 16px', fontSize: '0.8rem', fontWeight: '800', color: modoOscuro ? '#94a3b8' : '#475569', letterSpacing: '0.5px', textAlign: 'center' }}>NOTA FINAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {listaEvaluaciones.map((ev, index) => {
                      const colorEv = obtenerColorNota(ev.notaFinal);
                      const bgFila = index % 2 === 0 
                        ? 'transparent' 
                        : modoOscuro ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.005)';

                      return (
                        <tr
                          key={ev.id}
                          style={{
                            borderBottom: modoOscuro ? '1px solid rgba(255,255,255,0.05)' : '1px solid #e2e8f0',
                            backgroundColor: bgFila,
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = modoOscuro ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.015)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = bgFila}
                        >
                          <td style={{ padding: '14px 16px', fontWeight: 'bold', color: modoOscuro ? '#f8fafc' : '#1e293b' }}>
                            {ev.alumno}
                          </td>
                          <td style={{ padding: '14px 16px', color: modoOscuro ? '#94a3b8' : '#475569', fontWeight: '600' }}>
                            {ev.rubricaNombre}
                          </td>
                          <td
                            style={{
                              padding: '14px 16px',
                              fontSize: '0.82rem',
                              color: modoOscuro ? '#64748b' : '#94a3b8',
                              fontWeight: '600'
                            }}
                          >
                            {new Date(ev.fechaEvaluacion).toLocaleDateString()}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                            <span
                              style={{
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
                              }}
                            >
                              {ev.notaFinal.toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
