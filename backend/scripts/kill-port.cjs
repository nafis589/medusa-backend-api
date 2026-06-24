'use strict';

const { config } = require('dotenv');
const killPort = require('kill-port');

config({ override: true });

const port = Number(process.env.PORT ?? 5000);

killPort(port)
  .then(() => {
    console.log(`Port ${port} libéré.`);
  })
  .catch(() => {
    console.log(`Aucun processus sur le port ${port}.`);
  });
