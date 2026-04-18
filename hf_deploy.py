import os
import shutil
from huggingface_hub import HfApi

def deploy():
    print("Starting direct deployment to Hugging Face...")
    api = HfApi(token=os.getenv("HF_TOKEN"))
    
    repo_id = "samitkoya/CNAR"
    
    stage_dir = "hf_staging"
    if os.path.exists(stage_dir):
        shutil.rmtree(stage_dir, ignore_errors=True)
    
    # Exclude heavy/locked dirs during copy
    def ignore_files(dir, files):
        return [f for f in files if f in (".git", "node_modules", ".next", "out", "__pycache__", ".venv", "venv", "env", "india-towers.csv", "india-towers-processed.csv", "hf_staging")]
    
    shutil.copytree(".", stage_dir, ignore=ignore_files)
    
    print(f"Uploading files to {repo_id}...")
    api.upload_folder(
        folder_path=stage_dir,
        repo_id=repo_id,
        repo_type="space",
        commit_message="Direct Deployment of CNAR v2 to HF Spaces"
    )
    print("Deployment completed successfully!")
    shutil.rmtree(stage_dir, ignore_errors=True)

if __name__ == "__main__":
    deploy()
