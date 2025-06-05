import { env } from "@/env";
import { fal } from "@fal-ai/client";
import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { generations } from "../../db/schema/generations";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// Configure fal.ai client for server-side usage
fal.config({
  credentials: env.FAL_KEY,
});

export const generationRouter = createTRPCRouter({
  getAllByUser: protectedProcedure.query(async ({ ctx }) => {
    const generations = await ctx.db.query.generations.findMany({
      where: (table, { eq }) => eq(table.userId, ctx.session.user.id),
      orderBy: (table, { desc }) => desc(table.createdAt),
    });
    return generations;
  }),

  createRequest: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
        images: z.array(
          z.object({
            url: z.string().url(),
            width: z.number().nullish(),
            height: z.number().nullish(),
            content_type: z.string().nullish(),
            file_name: z.string().nullish(),
            file_size: z.number().nullish(),
          }),
        ),
        prompt: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Save to database
        const values = input.images.map((image) => ({
          requestId: input.requestId,
          userId: ctx.session.user.id,
          url: image.url,
          contentType: image.content_type,
          fileName: image.file_name,
          fileSize: image.file_size,
          width: image.width,
          height: image.height,
          prompt: input.prompt,
        }));
        await ctx.db.insert(generations).values(values);

        return {
          requestId: input.requestId,
        };
      } catch (error) {
        console.error("Image generation failed:", error);
        throw new Error("Failed to generate image");
      }
    }),
});
