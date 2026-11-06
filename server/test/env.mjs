// Loaded first by helpers.mjs, before the server module reads its limits: tests create many units from one IP.
process.env.INVITE_RATE_MAX = process.env.INVITE_RATE_MAX || '100000';
