'use client';
import { createContext, useContext } from 'react';
import type { ExperienceRuntime } from './runtime';
export const RuntimeContext = createContext<ExperienceRuntime | null>(null);
export const useMotionRuntime = () => useContext(RuntimeContext);
