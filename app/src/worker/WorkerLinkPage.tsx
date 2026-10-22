import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { setWorkerToken } from './api';

/** /w/:token — remembers the link on this phone and opens the page. */
export default function WorkerLinkPage() {
  const { token = '' } = useParams();
  useEffect(() => { if (token) setWorkerToken(token); }, [token]);
  return <Navigate to="/w" replace />;
}
