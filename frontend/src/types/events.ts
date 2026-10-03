export type EventType = 'status' | 'plan' | 'plan_update' | 'message' | 'approval_request' | 'done' | 'error' | 'thinking' | 'ping';

export interface BaseEvent {
  type: EventType;
}

export interface StatusEvent extends BaseEvent {
  type: 'status';
  content: string;
}

export interface PlanEvent extends BaseEvent {
  type: 'plan';
  steps: string[];
  current: string;
}

export interface PlanUpdateEvent extends BaseEvent {
  type: 'plan_update';
  current: string;
}

export interface MessageEvent extends BaseEvent {
  type: 'message';
  content: string;
  link?: {
    label: string;
    target: string;
  };
}

export interface ApprovalRequestEvent extends BaseEvent {
  type: 'approval_request';
  stage: string;
}

export interface ErrorEvent extends BaseEvent {
  type: 'error';
  content: string;
}

export interface DoneEvent extends BaseEvent {
  type: 'done';
}

export interface ThinkingEvent extends BaseEvent {
  type: 'thinking';
  content: string;
}

export interface PingEvent extends BaseEvent {
  type: 'ping';
}

export type WorkflowEvent = 
  | StatusEvent
  | PlanEvent
  | PlanUpdateEvent
  | MessageEvent
  | ApprovalRequestEvent
  | ErrorEvent
  | DoneEvent
  | ThinkingEvent
  | PingEvent;
