# Database Export Application

A full-stack application that allows users to connect to MySQL or PostgreSQL databases and export table data to CSV files.

## Features

- Support for MySQL and PostgreSQL databases
- Schema selection for PostgreSQL databases
- Interactive table selection
- Export selected tables to CSV format (downloaded as ZIP)
- Modern and responsive user interface
- Real-time connection status and error handling

## Tech Stack

### Frontend
- React.js
- Modern JavaScript (ES6+)
- CSS3 with modern features

### Backend
- Node.js
- Express.js
- mysql2 for MySQL connections
- pg for PostgreSQL connections
- archiver for ZIP file creation

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- Access to MySQL or PostgreSQL database

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/db-export-app.git
cd db-export-app
```

2. Install backend dependencies:
```bash
cd server
npm install
```

3. Install frontend dependencies:
```bash
cd ../client
npm install
```

## Configuration

1. Create a `.env` file in the server directory:
```bash
cd server
cp .env.example .env
```

2. Update the environment variables in `.env`:
```
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## Development

1. Start the backend server:
```bash
cd server
npm start
```

2. Start the frontend development server:
```bash
cd client
npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Production Deployment

### Backend
1. Set up environment variables on your hosting platform
2. Install dependencies: `npm install`
3. Start the server: `npm start`

### Frontend
1. Create production build:
```bash
cd client
npm run build
```
2. Deploy the contents of the `build` directory to your hosting platform

## Security Considerations

- Database credentials are only stored in memory during the session
- CORS is configured for security
- Input validation is implemented
- Error messages are sanitized
- Secure password handling

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/YourFeature`
3. Commit your changes: `git commit -m 'Add YourFeature'`
4. Push to the branch: `git push origin feature/YourFeature`
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 