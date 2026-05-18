import { Request, Response, NextFunction } from 'express';
import { AppConfig } from '../types';
import { createLogger } from '../utils/logger';

const log = createLogger();

/**
 * Middleware de validação de segurança dos postbacks.
 * Verifica token de segurança e IP de origem (se configurado).
 */
export function createSecurityMiddleware(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Verificar token de segurança (se configurado)
    if (config.postback.securityToken) {
      const token = req.query.token || req.query.auth_key || req.query.sskey || req.query.hash;
      if (!token || token !== config.postback.securityToken) {
        log.warn(
          { ip: req.ip, queryToken: token },
          'Postback rejeitado: token de segurança inválido'
        );
        res.status(401).json({ error: 'Token de segurança inválido' });
        return;
      }
    }

    // Verificar IP de origem (se configurado)
    if (config.postback.allowedIps && config.postback.allowedIps.length > 0) {
      const clientIp = req.ip || req.socket.remoteAddress || '';
      if (!config.postback.allowedIps.includes(clientIp)) {
        log.warn(
          { ip: clientIp, allowedIps: config.postback.allowedIps },
          'Postback rejeitado: IP não autorizado'
        );
        res.status(403).json({ error: 'IP não autorizado' });
        return;
      }
    }

    next();
  };
}