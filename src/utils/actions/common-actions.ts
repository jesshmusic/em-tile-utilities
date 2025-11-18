/**
 * Common action builders for Monk's Active Tiles
 */

/**
 * Create a play sound action
 * @param audiofile - Path to the audio file
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createPlaySoundAction(
  audiofile: string,
  options?: {
    audiofor?: string;
    volume?: number;
    loop?: boolean;
    fade?: number;
    scenerestrict?: boolean;
    prevent?: boolean;
    delay?: boolean;
    playlist?: boolean;
  }
): any {
  return {
    action: 'playsound',
    data: {
      audiofile,
      audiofor: options?.audiofor ?? 'everyone',
      volume: options?.volume ?? 1,
      loop: options?.loop ?? false,
      fade: options?.fade ?? 0.25,
      scenerestrict: options?.scenerestrict ?? false,
      prevent: options?.prevent ?? false,
      delay: options?.delay ?? false,
      playlist: options?.playlist ?? true
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a chat message action
 * @param text - The message text (can include Handlebars expressions)
 * @param options - Optional configuration
 * @returns Monk's Active Tiles action object
 */
export function createChatMessageAction(
  text: string,
  options?: {
    flavor?: string;
    whisper?: string;
    language?: string;
  }
): any {
  return {
    action: 'chatmessage',
    data: {
      text,
      flavor: options?.flavor ?? '',
      whisper: options?.whisper ?? '',
      language: options?.language ?? ''
    },
    id: foundry.utils.randomID()
  };
}

/**
 * Create a pause game action
 * @param pause - Whether to pause (true) or unpause (false)
 * @returns Monk's Active Tiles action object
 */
export function createPauseAction(pause: boolean = true): any {
  return {
    action: 'pause',
    data: {
      pause
    },
    id: foundry.utils.randomID()
  };
}
