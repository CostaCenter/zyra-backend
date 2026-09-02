import express from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { sequelize } from './db/db.js';
import { initPartidoSocket } from './socket/partidoSocket.js';
import authRoutes from './routes/authRoutes.js';
import complexRoutes from './routes/complexRoutes.js';
import courtRoutes from './routes/courtRoutes.js';
import canchaPreciosRoutes from './routes/canchaPreciosRoutes.js';
import configuracionFavoritosRoutes from './routes/configuracionFavoritosRoutes.js';
import explorarRoutes from './routes/explorarRoutes.js';
import reservaRoutes from './routes/reservaRoutes.js';
import complejoAccessRoutes from './routes/complejoAccessRoutes.js';
import miembrosRoutes from './routes/miembrosRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import finanzasRoutes from './routes/finanzasRoutes.js';
import torneosRoutes from './routes/torneosRoutes.js';
import partidosRoutes from './routes/partidosRoutes.js';
import teamsRoutes from './routes/teamsRoutes.js';
import perfilDeportivoRoutes from './routes/perfilDeportivoRoutes.js';
import usuariosRoutes from './routes/usuariosRoutes.js';
import publicacionesRoutes from './routes/publicacionesRoutes.js';
import seguidoresRoutes from './routes/seguidoresRoutes.js';
import notificacionesRoutes from './routes/notificacionesRoutes.js';
import dispositivosPushRoutes from './routes/dispositivosPushRoutes.js';
import buscarRoutes from './routes/buscarRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ message: 'Zyra Backend API' });
});

app.use('/auth', authRoutes);
app.use('/api/complexes', complexRoutes);
app.use('/api/courts', courtRoutes);
app.use('/api/canchas', canchaPreciosRoutes);
app.use('/api/precios/favoritos', configuracionFavoritosRoutes);
app.use('/api/explorar', explorarRoutes);
app.use('/api/reservas', reservaRoutes);
app.use('/api', complejoAccessRoutes);
app.use('/api/complejos/miembros', miembrosRoutes);
app.use('/api/complejos', finanzasRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/torneos', torneosRoutes);
app.use('/api/partidos', partidosRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/perfil-deportivo', perfilDeportivoRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/publicaciones', publicacionesRoutes);
app.use('/api/seguidores', seguidoresRoutes);
app.use('/api/notificaciones', notificacionesRoutes);
app.use('/api/dispositivos-push', dispositivosPushRoutes);
app.use('/api/buscar', buscarRoutes);

const server = http.createServer(app);
initPartidoSocket(server);

sequelize.sync({ force: false })
  .then(() => {
    console.log('✅ Base de datos sincronizada y modelos de Zyra cargados');
    server.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en el puerto ${PORT}`);
      console.log('📡 Socket.io activo para marcador en vivo');
    });
  })
  .catch((err) => {
    console.error('❌ Error al sincronizar la base de datos:', err);
    process.exit(1);
  });

export default app;
