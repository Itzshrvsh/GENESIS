import { httpServer, PORT } from './app';

httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

export default httpServer;