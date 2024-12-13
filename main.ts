import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import { MarketDataService } from './services/marketData';
import { CompanyService } from './services/company';
import { AnalysisService } from './services/analysis';
import { SentimentService } from './services/sentiment';
import { Database } from './database';
import { CacheService } from './services/cache';
import { Logger } from './utils/logger';
import swaggerUi from 'swagger-ui-express';
import swaggerDocument from './swagger.json';

// Load environment variables
dotenv.config();

class SearchInvestApp {
    private app: Express;
    private marketDataService: MarketDataService;
    private companyService: CompanyService;
    private analysisService: AnalysisService;
    private sentimentService: SentimentService;
    private database: Database;
    private cache: CacheService;
    private logger: Logger;

    constructor() {
        this.app = express();
        this.database = new Database();
        this.cache = new CacheService();
        this.logger = new Logger();

        // Initialize services
        this.marketDataService = new MarketDataService(
            process.env.ALPHA_VANTAGE_API_KEY as string,
            this.cache
        );
        this.companyService = new CompanyService(
            process.env.FINNHUB_API_KEY as string,
            this.cache
        );
        this.analysisService = new AnalysisService(this.database);
        this.sentimentService = new SentimentService(
            process.env.NEWS_API_KEY as string
        );

        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        this.app.use(express.json());
        this.app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
        this.app.use(this.logger.requestLogger.bind(this.logger));
    }

    private setupRoutes(): void {
        // Market Data Routes
        this.app.get('/api/market-data', async (req: Request, res: Response) => {
            try {
                const marketData = await this.marketDataService.getRealTimeData();
                res.json(marketData);
            } catch (error) {
                this.logger.error('Error fetching market data:', error);
                res.status(500).json({ error: 'Failed to fetch market data' });
            }
        });

        // Company Information Routes
        this.app.get('/api/company/:ticker', async (req: Request, res: Response) => {
            try {
                const companyInfo = await this.companyService.getCompanyInfo(req.params.ticker);
                res.json(companyInfo);
            } catch (error) {
                this.logger.error('Error fetching company info:', error);
                res.status(500).json({ error: 'Failed to fetch company information' });
            }
        });

        // Technical and Fundamental Analysis Routes
        this.app.get('/api/analysis/:ticker', async (req: Request, res: Response) => {
            try {
                const analysis = await this.analysisService.getAnalysis(req.params.ticker);
                res.json(analysis);
            } catch (error) {
                this.logger.error('Error performing analysis:', error);
                res.status(500).json({ error: 'Failed to perform analysis' });
            }
        });

        // Market Sentiment Routes
        this.app.get('/api/sentiment', async (req: Request, res: Response) => {
            try {
                const sentiment = await this.sentimentService.getMarketSentiment();
                res.json(sentiment);
            } catch (error) {
                this.logger.error('Error fetching sentiment data:', error);
                res.status(500).json({ error: 'Failed to fetch sentiment data' });
            }
        });

        // Health Check Route
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({ status: 'healthy', timestamp: new Date().toISOString() });
        });
    }

    public async start(): Promise<void> {
        try {
            await this.database.connect();
            await this.cache.connect();

            const port = process.env.PORT || 3000;
            this.app.listen(port, () => {
                this.logger.info(`Server is running on port ${port}`);
            });
        } catch (error) {
            this.logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    public async shutdown(): Promise<void> {
        try {
            await this.database.disconnect();
            await this.cache.disconnect();
            this.logger.info('Server shutdown complete');
        } catch (error) {
            this.logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
}

// Handle process termination
process.on('SIGTERM', async () => {
    const app = new SearchInvestApp();
    await app.shutdown();
});

process.on('SIGINT', async () => {
    const app = new SearchInvestApp();
    await app.shutdown();
});

// Start the application
if (require.main === module) {
    const app = ne
