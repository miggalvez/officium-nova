import { Type } from '@sinclair/typebox';
import type { FastifyInstance } from 'fastify';

import {
  composeCalendarMonth,
  resolveCalendarMonthRequest,
  type CalendarQuery
} from '../services/compose-calendar.js';
import {
  applyCacheHeaders,
  buildDeterministicEtag,
  calendarResponseCacheKey,
  createEtagMemoryCache,
  requestMatchesEtag
} from '../services/cache.js';

const calendarEtags = createEtagMemoryCache();

const ApiErrorSchema = Type.Object({
  kind: Type.Literal('error'),
  apiVersion: Type.Literal('v1'),
  code: Type.String(),
  message: Type.String(),
  details: Type.Optional(Type.Record(Type.String(), Type.Union([
    Type.String(),
    Type.Number(),
    Type.Boolean(),
    Type.Null()
  ]))),
  hints: Type.Optional(Type.Array(Type.String()))
});

const VersionDescriptorSchema = Type.Object({
  handle: Type.String(),
  kalendar: Type.String(),
  transfer: Type.String(),
  stransfer: Type.String(),
  base: Type.Optional(Type.String()),
  transferBase: Type.Optional(Type.String()),
  policyName: Type.String()
});

const WarningSchema = Type.Object({
  code: Type.String(),
  message: Type.String(),
  severity: Type.Union([
    Type.Literal('info'),
    Type.Literal('warn'),
    Type.Literal('error')
  ]),
  context: Type.Optional(Type.Record(Type.String(), Type.String()))
});

const FeastRefSchema = Type.Object({
  id: Type.String(),
  path: Type.String(),
  title: Type.String()
});

const RankSchema = Type.Object({
  name: Type.String(),
  classSymbol: Type.String(),
  weight: Type.Number()
});

const OctaveDaySchema = Type.Union([
  Type.Literal(1),
  Type.Literal(2),
  Type.Literal(3),
  Type.Literal(4),
  Type.Literal(5),
  Type.Literal(6),
  Type.Literal(7),
  Type.Literal(8)
]);

const CelebrationSchema = Type.Object({
  feast: FeastRefSchema,
  rank: RankSchema,
  source: Type.Union([Type.Literal('temporal'), Type.Literal('sanctoral')]),
  kind: Type.Optional(Type.Union([Type.Literal('vigil'), Type.Literal('octave')])),
  octaveDay: Type.Optional(OctaveDaySchema),
  transferredFrom: Type.Optional(Type.String())
});

const CommemorationSchema = Type.Object({
  feast: FeastRefSchema,
  rank: RankSchema,
  reason: Type.String(),
  hours: Type.Array(Type.String()),
  kind: Type.Optional(Type.Union([Type.Literal('vigil'), Type.Literal('octave')])),
  octaveDay: Type.Optional(OctaveDaySchema),
  color: Type.Optional(Type.String())
});

const CalendarMonthResponseSchema = Type.Object({
  kind: Type.Literal('calendar-month'),
  apiVersion: Type.Literal('v1'),
  year: Type.Number(),
  month: Type.Number(),
  version: VersionDescriptorSchema,
  days: Type.Array(Type.Object({
    date: Type.String(),
    dayOfWeek: Type.Number(),
    season: Type.String(),
    celebration: CelebrationSchema,
    commemorations: Type.Array(CommemorationSchema),
    warnings: Type.Array(WarningSchema)
  })),
  meta: Type.Object({
    contentVersion: Type.String(),
    canonicalPath: Type.String()
  })
});

export async function registerCalendarRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Params: { year: string; month: string };
    Querystring: CalendarQuery;
  }>('/api/v1/calendar/:year/:month', {
    schema: {
      params: Type.Object({
        year: Type.String(),
        month: Type.String()
      }),
      querystring: Type.Object({
        version: Type.Optional(Type.String()),
        rubrics: Type.Optional(Type.String())
      }),
      response: {
        200: CalendarMonthResponseSchema,
        304: Type.Null(),
        400: ApiErrorSchema,
        422: ApiErrorSchema,
        501: ApiErrorSchema,
        500: ApiErrorSchema
      }
    }
  }, async function calendarHandler(request, reply) {
    const resolved = resolveCalendarMonthRequest({
      context: app.apiContext,
      yearParam: request.params.year,
      monthParam: request.params.month,
      query: request.query
    });
    const cachedEtag = calendarEtags.get(resolved.cacheKey);
    if (cachedEtag) {
      applyCacheHeaders(reply, cachedEtag);
      if (requestMatchesEtag(request, cachedEtag)) {
        return reply.code(304).send();
      }
    }

    const body = composeCalendarMonth({
      context: app.apiContext,
      yearParam: request.params.year,
      monthParam: request.params.month,
      query: request.query,
      resolved
    });
    const etag = buildDeterministicEtag({
      key: calendarResponseCacheKey(body),
      body
    });
    calendarEtags.set(resolved.cacheKey, etag);
    applyCacheHeaders(reply, etag);
    if (requestMatchesEtag(request, etag)) {
      return reply.code(304).send();
    }
    return body;
  });
}
