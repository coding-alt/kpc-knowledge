import * as ora from 'ora';
import * as chalk from 'chalk';
import { createLogger } from '@kpc/shared';

const logger = createLogger('ProgressUtils');

export interface ProgressStep {
  name: string;
  description: string;
  weight?: number;
}

export interface ProgressOptions {
  showPercentage?: boolean;
  showETA?: boolean;
  showStepDetails?: boolean;
}

export class ProgressManager {
  private spinner: ora.Ora;
  private steps: ProgressStep[];
  private currentStep: number = 0;
  private startTime: number;
  private options: ProgressOptions;

  constructor(steps: ProgressStep[], options: ProgressOptions = {}) {
    this.steps = steps;
    this.options = {
      showPercentage: true,
      showETA: true,
      showStepDetails: true,
      ...options,
    };
    this.spinner = ora();
    this.startTime = Date.now();
  }

  start(initialMessage?: string): void {
    const message = initialMessage || this.getProgressMessage();
    this.spinner.start(message);
  }

  nextStep(message?: string): void {
    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++;
      const progressMessage = message || this.getProgressMessage();
      this.spinner.text = progressMessage;
    }
  }

  updateMessage(message: string): void {
    this.spinner.text = message;
  }

  succeed(message?: string): void {
    const finalMessage = message || `✅ Completed all ${this.steps.length} steps`;
    this.spinner.succeed(finalMessage);
  }

  fail(message?: string, error?: Error): void {
    const failMessage = message || `❌ Failed at step ${this.currentStep + 1}`;
    this.spinner.fail(failMessage);
    
    if (error) {
      logger.error('Progress failed:', error);
    }
  }

  warn(message: string): void {
    this.spinner.warn(message);
  }

  info(message: string): void {
    this.spinner.info(message);
  }

  private getProgressMessage(): string {
    const currentStepInfo = this.steps[this.currentStep];
    const stepNumber = this.currentStep + 1;
    const totalSteps = this.steps.length;
    
    let message = `[${stepNumber}/${totalSteps}] ${currentStepInfo.name}`;

    if (this.options.showPercentage) {
      const percentage = Math.round((stepNumber / totalSteps) * 100);
      message += ` (${percentage}%)`;
    }

    if (this.options.showStepDetails && currentStepInfo.description) {
      message += ` - ${currentStepInfo.description}`;
    }

    if (this.options.showETA && this.currentStep > 0) {
      const eta = this.calculateETA();
      if (eta) {
        message += ` - ETA: ${eta}`;
      }
    }

    return message;
  }

  private calculateETA(): string | null {
    const elapsed = Date.now() - this.startTime;
    const progress = (this.currentStep + 1) / this.steps.length;
    
    if (progress > 0.1) { // Only show ETA after 10% progress
      const totalEstimated = elapsed / progress;
      const remaining = totalEstimated - elapsed;
      
      if (remaining > 1000) {
        const seconds = Math.round(remaining / 1000);
        if (seconds < 60) {
          return `${seconds}s`;
        } else {
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = seconds % 60;
          return `${minutes}m ${remainingSeconds}s`;
        }
      }
    }
    
    return null;
  }

  getCurrentStep(): ProgressStep {
    return this.steps[this.currentStep];
  }

  getProgress(): number {
    return (this.currentStep + 1) / this.steps.length;
  }

  isComplete(): boolean {
    return this.currentStep >= this.steps.length - 1;
  }
}

export class MultiStageProgress {
  private stages: { name: string; progress: ProgressManager }[] = [];
  private currentStage: number = 0;

  addStage(name: string, steps: ProgressStep[], options?: ProgressOptions): void {
    this.stages.push({
      name,
      progress: new ProgressManager(steps, options),
    });
  }

  startStage(stageIndex?: number): void {
    const index = stageIndex ?? this.currentStage;
    if (index < this.stages.length) {
      const stage = this.stages[index];
      console.log(chalk.blue(`\n🚀 Starting stage: ${stage.name}`));
      stage.progress.start();
    }
  }

  nextStage(): boolean {
    if (this.currentStage < this.stages.length - 1) {
      this.stages[this.currentStage].progress.succeed();
      this.currentStage++;
      this.startStage();
      return true;
    }
    return false;
  }

  getCurrentStage(): ProgressManager | null {
    return this.stages[this.currentStage]?.progress || null;
  }

  completeAll(): void {
    if (this.currentStage < this.stages.length) {
      this.stages[this.currentStage].progress.succeed();
    }
    
    console.log(chalk.green(`\n🎉 All ${this.stages.length} stages completed successfully!`));
  }

  failStage(message?: string, error?: Error): void {
    const currentStage = this.stages[this.currentStage];
    if (currentStage) {
      currentStage.progress.fail(message, error);
    }
  }
}

export function createProgressSteps(operations: string[]): ProgressStep[] {
  return operations.map((op, index) => ({
    name: op,
    description: `Step ${index + 1}`,
    weight: 1,
  }));
}

export function withProgress<T>(
  steps: ProgressStep[],
  operation: (progress: ProgressManager) => Promise<T>,
  options?: ProgressOptions
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    const progress = new ProgressManager(steps, options);
    
    try {
      progress.start();
      const result = await operation(progress);
      progress.succeed();
      resolve(result);
    } catch (error) {
      progress.fail(undefined, error as Error);
      reject(error);
    }
  });
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }
}

export function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = (bytes / Math.pow(1024, i)).toFixed(1);
  
  return `${size} ${sizes[i]}`;
}

export function createLoadingAnimation(message: string, duration: number = 2000): Promise<void> {
  return new Promise((resolve) => {
    const spinner = ora(message).start();
    
    setTimeout(() => {
      spinner.succeed();
      resolve();
    }, duration);
  });
}