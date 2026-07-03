import { Result } from "better-result";
import { Elysia } from "elysia";

import { WeatherService } from "~/features/weather/api/weather-service";
import { GetWeatherQuerySchema } from "~/features/weather/schemas/weather-schema";
import { errorResponse } from "~/lib/route-error";

export const weatherRoutes = new Elysia({ prefix: "/weather" }).get(
  "/",
  async ({ query }) => {
    const result = await WeatherService.get(query);

    return Result.isError(result)
      ? errorResponse("weather-routes", result.error)
      : { ok: true as const, report: result.value };
  },
  { query: GetWeatherQuerySchema },
);
