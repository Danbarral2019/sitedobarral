'use client';

import { useState, createContext, useContext, ReactNode } from 'react';

interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

interface TabsProps {
  defaultTab: string;
  children: ReactNode;
  className?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function Tabs({ defaultTab, children, className = '', activeTab: controlledTab, onTabChange }: TabsProps) {
  const [internalTab, setInternalTab] = useState(defaultTab);

  const isControlled = controlledTab !== undefined && onTabChange !== undefined;
  const activeTab = isControlled ? controlledTab : internalTab;
  const setActiveTab = isControlled ? onTabChange : setInternalTab;

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

interface TabListProps {
  children: ReactNode;
  className?: string;
}

export function TabList({ children, className = '' }: TabListProps) {
  return (
    <div className={`flex border-b border-gray-200 mb-6 ${className}`}>
      {children}
    </div>
  );
}

interface TabProps {
  id: string;
  children: ReactNode;
  icon?: ReactNode;
  badge?: number;
}

export function Tab({ id, children, icon, badge }: TabProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab must be used within Tabs');

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === id;

  return (
    <button
      onClick={() => setActiveTab(id)}
      className={`
        relative px-6 py-3 font-medium text-sm transition-all
        border-b-2 flex items-center gap-2
        ${isActive
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
        }
      `}
    >
      {icon && <span className="w-5 h-5">{icon}</span>}
      {children}
      {badge !== undefined && badge > 0 && (
        <span className="ml-2 px-2 py-0.5 bg-red-500 text-surface-page text-xs font-bold rounded-full">
          {badge}
        </span>
      )}
    </button>
  );
}

interface TabPanelProps {
  id: string;
  children: ReactNode;
}

export function TabPanel({ id, children }: TabPanelProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabPanel must be used within Tabs');

  const { activeTab } = context;

  if (activeTab !== id) return null;

  return <div>{children}</div>;
}
