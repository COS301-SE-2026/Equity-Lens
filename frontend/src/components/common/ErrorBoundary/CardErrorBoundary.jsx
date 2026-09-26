import { Component } from 'react';

import { GlassPanel, PanelHead } from '../../dashboard/shared/GlassPanel';
import SecondaryButton from '../../dashboard/shared/SecondaryButton';

/**
 * @extends {Component<{ label: string, children: React.ReactNode }, { hasError: boolean }>}
 */
class CardErrorBoundary extends Component {
  /** @param {{ label: string, children: React.ReactNode }} props */
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  /**
   * @param {Error} error
   * @param {React.ErrorInfo} info
   */
  componentDidCatch(error, info) {
    console.error(`${this.props.label} failed to render:`, error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <GlassPanel className="flex flex-col">
        <PanelHead label={this.props.label} />
        <div className="space-y-3 p-5 text-center">
          <p className="text-[13px]" style={{ color: 'var(--signal-negative)' }}>
            This section could not be displayed.
          </p>
          <SecondaryButton size="sm" onClick={this.handleRetry}>
            Try again
          </SecondaryButton>
        </div>
      </GlassPanel>
    );
  }
}

export default CardErrorBoundary;
