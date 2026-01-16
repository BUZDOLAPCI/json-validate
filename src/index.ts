#!/usr/bin/env node

import { startHttpTransport } from './transport/http.js';

startHttpTransport({ port: 8080 });
