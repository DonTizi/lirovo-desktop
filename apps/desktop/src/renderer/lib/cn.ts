import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge class names, letting a later Tailwind class win over an earlier one. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
