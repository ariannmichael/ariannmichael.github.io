"use client";

import { Component, type ReactNode } from "react";

interface Props {
  name: string;
  fallback: ReactNode;
  children: ReactNode;
}

/** Keeps one broken/missing .glb from taking down the whole world: render the fallback instead. */
export class ModelErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(`[world] failed to load ${this.props.name}; rendering a placeholder`, error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
