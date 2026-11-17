import {Component,type ReactNode} from "react";
import {AlertTriangle,RefreshCw} from "lucide-react";

export class WorkspaceRecovery extends Component<{children:ReactNode},{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error){console.error("Workspace rendering failed",error);}
  render(){
    if(!this.state.failed)return this.props.children;
    return <main className="workspace-recovery" data-testid="workspace-render-error">
      <section className="content-panel" role="alert">
        <div className="panel-heading"><h1>Workspace needs a reload</h1><AlertTriangle size={22}/></div>
        <div className="content-body form-stack">
          <p>A screen or application module could not be loaded. Your saved projects and issued documents remain on the server.</p>
          <p className="field-note">Reloading returns to the last saved revision. Unsaved changes held only in this page may be lost; use a current saved revision when reopening the workspace.</p>
          <button className="button primary" onClick={()=>window.location.reload()}><RefreshCw size={17}/>Reload workspace</button>
        </div>
      </section>
    </main>;
  }
}
