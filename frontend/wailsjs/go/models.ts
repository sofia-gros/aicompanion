export namespace llm {
	
	export class CharacterProfile {
	    id: string;
	    name: string;
	    personality: string;
	    toneRule: string;
	    firstPerson: string;
	    secondPerson: string;
	    ttsEngine: string;
	    speakerId: number;
	    examples: string[][];
	
	    static createFrom(source: any = {}) {
	        return new CharacterProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.personality = source["personality"];
	        this.toneRule = source["toneRule"];
	        this.firstPerson = source["firstPerson"];
	        this.secondPerson = source["secondPerson"];
	        this.ttsEngine = source["ttsEngine"];
	        this.speakerId = source["speakerId"];
	        this.examples = source["examples"];
	    }
	}

}

export namespace main {
	
	export class SystemConfig {
	    displayMode: string;
	    isClickThrough: boolean;
	    llmTier: string;
	    ttsEngine: string;
	    speakerId: number;
	    volume: number;
	    lipSyncSensitivity: number;
	    eyeTrackingSensitivity: number;
	    webSearchEnabled: boolean;
	    tavilyApiKey: string;
	    cloudApiKey: string;
	    cloudApiBaseUrl: string;
	    cloudApiModel: string;
	    classifierMode: string;
	    classifierModel: string;
	
	    static createFrom(source: any = {}) {
	        return new SystemConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.displayMode = source["displayMode"];
	        this.isClickThrough = source["isClickThrough"];
	        this.llmTier = source["llmTier"];
	        this.ttsEngine = source["ttsEngine"];
	        this.speakerId = source["speakerId"];
	        this.volume = source["volume"];
	        this.lipSyncSensitivity = source["lipSyncSensitivity"];
	        this.eyeTrackingSensitivity = source["eyeTrackingSensitivity"];
	        this.webSearchEnabled = source["webSearchEnabled"];
	        this.tavilyApiKey = source["tavilyApiKey"];
	        this.cloudApiKey = source["cloudApiKey"];
	        this.cloudApiBaseUrl = source["cloudApiBaseUrl"];
	        this.cloudApiModel = source["cloudApiModel"];
	        this.classifierMode = source["classifierMode"];
	        this.classifierModel = source["classifierModel"];
	    }
	}

}

export namespace platform {
	
	export class SystemSpec {
	    totalRamGb: number;
	    availableRamGb: number;
	    recommendedTier: string;
	    recommendation: string;
	
	    static createFrom(source: any = {}) {
	        return new SystemSpec(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.totalRamGb = source["totalRamGb"];
	        this.availableRamGb = source["availableRamGb"];
	        this.recommendedTier = source["recommendedTier"];
	        this.recommendation = source["recommendation"];
	    }
	}
	export class SystemUsage {
	    cpuPercent: number;
	    ramPercent: number;
	    ramUsedGb: number;
	    ramTotalGb: number;
	    romPercent: number;
	    romFreeGb: number;
	    romTotalGb: number;
	    gpuInfo: string;
	
	    static createFrom(source: any = {}) {
	        return new SystemUsage(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.cpuPercent = source["cpuPercent"];
	        this.ramPercent = source["ramPercent"];
	        this.ramUsedGb = source["ramUsedGb"];
	        this.ramTotalGb = source["ramTotalGb"];
	        this.romPercent = source["romPercent"];
	        this.romFreeGb = source["romFreeGb"];
	        this.romTotalGb = source["romTotalGb"];
	        this.gpuInfo = source["gpuInfo"];
	    }
	}

}

export namespace websearch {
	
	export class SearchConfig {
	    enabled: boolean;
	    tavilyApiKey: string;
	    cloudApiKey: string;
	    cloudApiBaseUrl: string;
	    cloudApiModel: string;
	    classifierMode: string;
	    classifierModel: string;
	
	    static createFrom(source: any = {}) {
	        return new SearchConfig(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.enabled = source["enabled"];
	        this.tavilyApiKey = source["tavilyApiKey"];
	        this.cloudApiKey = source["cloudApiKey"];
	        this.cloudApiBaseUrl = source["cloudApiBaseUrl"];
	        this.cloudApiModel = source["cloudApiModel"];
	        this.classifierMode = source["classifierMode"];
	        this.classifierModel = source["classifierModel"];
	    }
	}

}

