import React, { useRef } from 'react';

interface WelcomeScreenProps {
  hasExistingProject: boolean;
  onContinue: () => void;
  onNew: () => void;
  onLoadBackup: (file: File) => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  hasExistingProject,
  onContinue,
  onNew,
  onLoadBackup,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onLoadBackup(file);
    }
  };

  const handleLoadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-800 text-white">
      <div className="text-center bg-gray-900/50 p-12 rounded-xl shadow-2xl backdrop-blur-md border border-gray-700/50">
        <h1 className="text-5xl font-bold mb-4">Estúdio do Escritor</h1>
        <p className="text-lg text-gray-400 mb-10">Sua escrivaninha digital para grandes histórias.</p>
        <div className="flex flex-col items-center gap-4">
          <button
            onClick={onContinue}
            disabled={!hasExistingProject}
            className="w-64 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            Continuar Último Projeto
          </button>
          <button
            onClick={onNew}
            className="w-64 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold text-lg"
          >
            Novo Projeto
          </button>
          <button
            onClick={handleLoadClick}
            className="w-64 px-6 py-3 bg-transparent border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700/50 hover:border-gray-500 transition-colors font-semibold text-lg"
          >
            Carregar Backup (.json)
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".json"
            className="hidden"
          />
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;