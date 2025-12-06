"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface StepperContextValue {
  currentStep: number;
  totalSteps: number;
}

const StepperContext = React.createContext<StepperContextValue | null>(null);

function useStepper() {
  const context = React.useContext(StepperContext);
  if (!context) {
    throw new Error("useStepper must be used within a Stepper");
  }
  return context;
}

interface StepperProps {
  currentStep: number;
  children: React.ReactNode;
  className?: string;
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ currentStep, children, className }, ref) => {
    const steps = React.Children.toArray(children);
    const totalSteps = steps.length;

    return (
      <StepperContext.Provider value={{ currentStep, totalSteps }}>
        <div ref={ref} className={cn("w-full", className)}>
          <div className="flex items-center justify-between">
            {steps.map((child, index) => (
              <React.Fragment key={index}>
                {child}
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 h-0.5 flex-1 transition-colors",
                      index < currentStep - 1 ? "bg-primary" : "bg-muted"
                    )}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </StepperContext.Provider>
    );
  }
);
Stepper.displayName = "Stepper";

interface StepProps {
  step: number;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

const Step = React.forwardRef<HTMLDivElement, StepProps>(
  ({ step, title, children, className }, ref) => {
    const { currentStep } = useStepper();
    const isActive = currentStep === step;
    const isCompleted = currentStep > step;

    return (
      <div
        ref={ref}
        className={cn("flex flex-col items-center gap-2", className)}
      >
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
            isCompleted && "border-primary bg-primary text-primary-foreground",
            isActive && "border-primary bg-background text-primary",
            !isActive &&
              !isCompleted &&
              "border-muted bg-muted text-muted-foreground"
          )}
        >
          {isCompleted ? (
            <svg
              className="h-5 w-5"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            step
          )}
        </div>
        {(title || children) && (
          <div className="text-center">
            {title && (
              <p
                className={cn(
                  "text-sm font-medium",
                  isActive && "text-foreground",
                  !isActive && "text-muted-foreground"
                )}
              >
                {title}
              </p>
            )}
            {children}
          </div>
        )}
      </div>
    );
  }
);
Step.displayName = "Step";

export { Stepper, Step };
