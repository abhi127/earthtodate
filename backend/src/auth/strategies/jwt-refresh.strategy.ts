// ponytail: simple refresh strategy - just validates the token exists
// Upgrade: add user lookup + token revocation check if using DB-backed refresh
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor() {
    super({
      jwtFromRequest: (req: Request) => req.body?.refreshToken,
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-key',
    });
  }

  async validate(payload: { sub: string }) {
    return { id: payload.sub };
  }
}
