import { cors } from '../lib/util.js';

export default function handler(req, res) {
  cors(res);
  res.status(200).json({ status: 'ok', service: 'mas-vyzva-api', time: new Date().toISOString() });
}
