import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, addDoc, getDocs } from 'firebase/firestore';

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

export default function App() {
  // Ahora tenemos 3 pantallas: 'disenador', 'evaluador' o 'historial'
  const [pantalla, setPantalla] = useState<
    'disenador' | 'evaluador' | 'historial'
  >('disenador');

  // --- ESTADOS ---
  const [nombreRubrica, setNombreRubrica] = useState('');
  const [criterios, setCriterios] = useState<Criterio[]>([
    { item: '', porcentaje: 0 },
  ]);
  const [listaRubricas, setListaRubricas] = useState<Rubrica[]>([]);
  const [rubricaSeleccionada, setRubricaSeleccionada] =
    useState<Rubrica | null>(null);
  const [nombreAlumno, setNombreAlumno] = useState('');
  const [notasEvaluacion, setNotasEvaluacion] = useState<{
    [key: string]: number;
  }>({});

  // Estado nuevo para la lista de notas guardadas
  const [listaEvaluaciones, setListaEvaluaciones] = useState<Evaluacion[]>([]);

  // Cargar las rúbricas desde Firebase
  const cargarRubricas = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'rubricas'));
      const rubricasCargadas: Rubrica[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        rubricasCargadas.push({
          id: doc.id,
          nombre: data.nombre,
          criterios: data.criterios,
        });
      });
      setListaRubricas(rubricasCargadas);
    } catch (error) {
      console.error('Error al cargar rúbricas: ', error);
    }
  };

  // Cargar las evaluaciones/notas desde Firebase
  const cargarEvaluaciones = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'evaluaciones'));
      const evaluacionesCargadas: Evaluacion[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        evaluacionesCargadas.push({
          id: doc.id,
          alumno: data.alumno,
          rubricaNombre: data.rubricaNombre,
          notaFinal: data.notaFinal,
          fechaEvaluacion: data.fechaEvaluacion,
          notasDetalle: data.notasDetalle || {},
        });
      });
      // Ordenar por fecha para que las más recientes salgan arriba
      evaluacionesCargadas.sort(
        (a, b) =>
          new Date(b.fechaEvaluacion).getTime() -
          new Date(a.fechaEvaluacion).getTime()
      );
      setListaEvaluaciones(evaluacionesCargadas);
    } catch (error) {
      console.error('Error al cargar evaluaciones: ', error);
    }
  };

  // Controlar qué cargar según la pestaña activa
  useEffect(() => {
    if (pantalla === 'evaluador') {
      cargarRubricas();
      setRubricaSeleccionada(null);
      setNombreAlumno('');
      setNotasEvaluacion({});
    } else if (pantalla === 'historial') {
      cargarEvaluaciones();
    }
  }, [pantalla]);

  // Funciones del Diseñador
  const handleAñadirCriterio = () => {
    setCriterios([...criterios, { item: '', porcentaje: 0 }]);
  };

  const handleCambioCriterio = (
    index: number,
    campo: keyof Criterio,
    valor: string
  ) => {
    const nuevosCriterios = [...criterios];
    if (campo === 'porcentaje') {
      nuevosCriterios[index][campo] = Number(valor);
    } else {
      nuevosCriterios[index][campo] = valor as any;
    }
    setCriterios(nuevosCriterios);
  };

  const handleGuardarRubrica = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalPorcentaje = criterios.reduce(
      (acc, curr) => acc + curr.porcentaje,
      0
    );
    if (totalPorcentaje !== 100) {
      alert(
        `El porcentaje total debe ser 100%. Actualmente es ${totalPorcentaje}%`
      );
      return;
    }
    try {
      await addDoc(collection(db, 'rubricas'), {
        nombre: nombreRubrica,
        criterios: criterios,
        fechaCreacion: new Date().toISOString(),
      });
      alert('¡Rúbrica guardada con éxito en Firebase!');
      setNombreRubrica('');
      setCriterios([{ item: '', porcentaje: 0 }]);
    } catch (error) {
      alert('Hubo un error al guardar.');
    }
  };

  // Funciones del Evaluador
  const handleSeleccionarRubrica = (id: string) => {
    const encontrada = listaRubricas.find((r) => r.id === id);
    if (encontrada) {
      setRubricaSeleccionada(encontrada);
      const notasIniciales: { [key: string]: number } = {};
      encontrada.criterios.forEach((c) => {
        notasIniciales[c.item] = 0;
      });
      setNotasEvaluacion(notasIniciales);
    } else {
      setRubricaSeleccionada(null);
    }
  };

  const handleCambioNota = (item: string, nota: string) => {
    setNotasEvaluacion({ ...notasEvaluacion, [item]: Number(nota) });
  };

  const calcularNotaFinal = () => {
    if (!rubricaSeleccionada) return 0;
    let sumaPonderada = 0;
    rubricaSeleccionada.criterios.forEach((c) => {
      const nota = notasEvaluacion[c.item] || 0;
      sumaPonderada += nota * (c.porcentaje / 100);
    });
    return Number(sumaPonderada.toFixed(2));
  };

  const handleGuardarEvaluacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rubricaSeleccionada || !nombreAlumno) return;
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
      alert(`¡Evaluación de ${nombreAlumno} guardada! Nota: ${notaFinal}`);
      setNombreAlumno('');
      setNotasEvaluacion({});
    } catch (error) {
      alert('Error al guardar la evaluación.');
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        fontFamily: 'sans-serif',
        maxWidth: '800px',
        margin: '0 auto',
      }}
    >
      {/* MENÚ DE PESTAÑAS (3 BOTONES) */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '30px',
          borderBottom: '2px solid #ccc',
          paddingBottom: '10px',
        }}
      >
        <button
          onClick={() => setPantalla('disenador')}
          style={{
            padding: '10px 15px',
            fontSize: '15px',
            cursor: 'pointer',
            backgroundColor: pantalla === 'disenador' ? '#007bff' : '#eee',
            color: pantalla === 'disenador' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          📝 Diseñar Rúbricas
        </button>
        <button
          onClick={() => setPantalla('evaluador')}
          style={{
            padding: '10px 15px',
            fontSize: '15px',
            cursor: 'pointer',
            backgroundColor: pantalla === 'evaluador' ? '#007bff' : '#eee',
            color: pantalla === 'evaluador' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          🎓 Evaluar Alumnos
        </button>
        <button
          onClick={() => setPantalla('historial')}
          style={{
            padding: '10px 15px',
            fontSize: '15px',
            cursor: 'pointer',
            backgroundColor: pantalla === 'historial' ? '#007bff' : '#eee',
            color: pantalla === 'historial' ? 'white' : 'black',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          📋 Historial de Notas
        </button>
      </div>

      {/* PANTALLA 1: DISEÑADOR */}
      {pantalla === 'disenador' && (
        <form onSubmit={handleGuardarRubrica}>
          <h2>Crear Nueva Rúbrica</h2>
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontWeight: 'bold',
                marginBottom: '5px',
              }}
            >
              Nombre de la Rúbrica:
            </label>
            <input
              type="text"
              value={nombreRubrica}
              onChange={(e) => setNombreRubrica(e.target.value)}
              placeholder="Ej: Exposición Oral"
              required
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <h3>Ítems de evaluación</h3>
          {criterios.map((criterio, index) => (
            <div
              key={index}
              style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}
            >
              <input
                type="text"
                placeholder="Ej: Ortografía"
                value={criterio.item}
                onChange={(e) =>
                  handleCambioCriterio(index, 'item', e.target.value)
                }
                required
                style={{ flex: 3, padding: '8px' }}
              />
              <input
                type="number"
                placeholder="%"
                value={criterio.porcentaje || ''}
                onChange={(e) =>
                  handleCambioCriterio(index, 'porcentaje', e.target.value)
                }
                required
                style={{ flex: 1, padding: '8px', maxWidth: '70px' }}
              />
              <span style={{ alignSelf: 'center', fontWeight: 'bold' }}>%</span>
            </div>
          ))}
          <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={handleAñadirCriterio}
              style={{ padding: '10px' }}
            >
              ➕ Añadir Ítem
            </button>
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginLeft: 'auto',
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
          <h2>Evaluar Alumno</h2>
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontWeight: 'bold',
                marginBottom: '5px',
              }}
            >
              1. Elige una Rúbrica:
            </label>
            <select
              onChange={(e) => handleSeleccionarRubrica(e.target.value)}
              style={{ width: '100%', padding: '10px', fontSize: '16px' }}
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

          {rubricaSeleccionada && (
            <form
              onSubmit={handleGuardarEvaluacion}
              style={{
                border: '1px solid #ddd',
                padding: '20px',
                borderRadius: '8px',
                backgroundColor: '#f9f9f9',
              }}
            >
              <h3>Rúbrica: {rubricaSeleccionada.nombre}</h3>
              <div style={{ marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'block',
                    fontWeight: 'bold',
                    marginBottom: '5px',
                  }}
                >
                  Nombre del Alumno:
                </label>
                <input
                  type="text"
                  value={nombreAlumno}
                  onChange={(e) => setNombreAlumno(e.target.value)}
                  placeholder="Nombre del alumno"
                  required
                  style={{
                    width: '100%',
                    padding: '8px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <h4>Notas por ítem (0 al 10)</h4>
              {rubricaSeleccionada.criterios.map((c, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <div>
                    <strong>{c.item}</strong>{' '}
                    <span style={{ color: '#666', fontSize: '14px' }}>
                      ({c.porcentaje}%)
                    </span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    value={notasEvaluacion[c.item] ?? ''}
                    onChange={(e) => handleCambioNota(c.item, e.target.value)}
                    required
                    style={{
                      padding: '6px',
                      width: '70px',
                      textAlign: 'center',
                    }}
                  />
                </div>
              ))}
              <div
                style={{
                  marginTop: '20px',
                  padding: '15px',
                  backgroundColor: '#e9ecef',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>NOTA FINAL:</span>
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#007bff',
                  }}
                >
                  {calcularNotaFinal()}
                </span>
              </div>
              <button
                type="submit"
                style={{
                  width: '100%',
                  marginTop: '20px',
                  padding: '12px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  fontSize: '16px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                💾 Guardar Notas
              </button>
            </form>
          )}
        </div>
      )}

      {/* PANTALLA 3: HISTORIAL DE NOTAS (NUEVA) */}
      {pantalla === 'historial' && (
        <div>
          <h2>Historial de Alumnos Evaluados</h2>
          {listaEvaluaciones.length === 0 ? (
            <p>Aún no hay alumnos evaluados en la base de datos.</p>
          ) : (
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                marginTop: '10px',
              }}
            >
              <thead>
                <tr
                  style={{
                    backgroundColor: '#f2f2f2',
                    borderBottom: '2px solid #ddd',
                    textAlign: 'left',
                  }}
                >
                  <th style={{ padding: '12px' }}>Alumno</th>
                  <th style={{ padding: '12px' }}>Rúbrica usada</th>
                  <th style={{ padding: '12px' }}>Fecha</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>
                    Nota Final
                  </th>
                </tr>
              </thead>
              <tbody>
                {listaEvaluaciones.map((ev) => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>
                      {ev.alumno}
                    </td>
                    <td style={{ padding: '12px', color: '#555' }}>
                      {ev.rubricaNombre}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        fontSize: '14px',
                        color: '#777',
                      }}
                    >
                      {new Date(ev.fechaEvaluacion).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span
                        style={{
                          padding: '5px 10px',
                          borderRadius: '4px',
                          fontWeight: 'bold',
                          backgroundColor:
                            ev.notaFinal >= 5 ? '#d4edda' : '#f8d7da',
                          color: ev.notaFinal >= 5 ? '#155724' : '#721c24',
                        }}
                      >
                        {ev.notaFinal}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
