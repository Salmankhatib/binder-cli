// tests/fixtures/trpc-app/src/router.ts
import { z } from 'zod';

export type AppRouter = {
  user: {
    list: {
      useQuery: (input: void) => { data: { id: string; name: string }[]; isLoading: boolean; isError: boolean };
    };
    getById: {
      useQuery: (input: { id: string }) => { data: { id: string; name: string; email: string }; isLoading: boolean; isError: boolean };
    };
    update: {
      useMutation: () => { mutate: (input: { id: string; name?: string }) => void };
    };
  };
  post: {
    list: {
      useQuery: (input: { limit?: number }) => { data: { id: string; title: string }[]; isLoading: boolean };
    };
  };
};
